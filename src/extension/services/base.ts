import { ServiceConfig, QueueItem } from '@/common/types';

export abstract class BaseStreamingService {
  protected abstract readonly config: ServiceConfig;
  private observer: MutationObserver | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSeriesCheckInProgress = false;
  private isProcessingUpdates = false;

  public getConfig(): ServiceConfig {
    return this.config;
  }

  public isVideoPage(url: string): boolean {
    return new RegExp(this.config.urlPattern).test(url);
  }

  private debounce(callback: () => void, delay: number = 500): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(callback, delay);
  }

  public startObserving(callback: () => void): void {
    // Stop any existing observer
    this.stopObserving();

    // Create new observer
    this.observer = new MutationObserver((mutations) => {
      // Skip if we're currently processing updates
      if (this.isProcessingUpdates) {
        return;
      }

      // Filter out mutations that are just our own button additions
      const relevantMutations = mutations.filter(mutation => {
        // Check added nodes
        const addedNodes = Array.from(mutation.addedNodes);
        const isOurButton = addedNodes.some(node => {
          if (node instanceof HTMLElement) {
            return node.hasAttribute('data-uq-button') || 
                   node.querySelector('[data-uq-button]') !== null;
          }
          return false;
        });
        
        return !isOurButton;
      });

      // Only proceed if we have relevant mutations
      if (relevantMutations.length > 0) {
        this.debounce(async () => {
          this.isProcessingUpdates = true;
          try {
            await callback();
          } finally {
            this.isProcessingUpdates = false;
          }
        });
      }
    });

    // Start observing with a configuration that watches for added nodes and subtree changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[BaseStreamingService] Started observing DOM changes');
  }

  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('[BaseStreamingService] Stopped observing DOM changes');
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  public async checkIsSeries(): Promise<boolean> {
    // If a check is already in progress, return false
    if (this.isSeriesCheckInProgress) {
      console.log('[BaseStreamingService] Series check already in progress, skipping');
      return false;
    }

    this.isSeriesCheckInProgress = true;
    try {
      const result = await this.config.isSeries();
      return result || false;
    } finally {
      this.isSeriesCheckInProgress = false;
    }
  }

  public async getSeriesData(): Promise<QueueItem[]> {
    if (!this.config.getSeriesData) {
      return [];
    }
    const seriesData = await this.config.getSeriesData();
    return seriesData?.episodes || [];
  }

  protected extractEpisodeInfo(element: Element, config: ServiceConfig): Partial<QueueItem> {
    const { episodeInfo } = config;
    if (!episodeInfo) return {};

    const {
      titleSelector,
      durationSelector,
      progressSelector
    } = episodeInfo;

    const title = element.querySelector(titleSelector)?.textContent?.trim();
    const duration = durationSelector ? element.querySelector(durationSelector)?.textContent?.trim() : undefined;
    const progress = progressSelector ? element.querySelector(progressSelector) : undefined;

    return {
      title,
      duration: duration ? this.parseDuration(duration) : undefined,
      progress: progress ? this.parseProgress(progress) : 0,
      type: 'episode' as const
    };
  }

  protected parseDuration(duration: string): number | undefined {
    // Override this in child classes if needed
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return undefined;
  }

  protected isEpisodeWatched(_progressElement: Element): boolean {
    // Default implementation - override in specific service classes if needed
    return false;
  }

  protected parseProgress(progressElement: Element): number {
    // Default implementation - override in specific service classes if needed
    const value = progressElement.getAttribute('value');
    return value ? parseFloat(value) : 0;
  }
} 