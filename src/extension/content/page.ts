import { ServiceConfig, QueueItem } from '@/common/types';
import { UIManager } from './ui';

export class PageManager {
  private static instance: PageManager;
  private config: ServiceConfig | null = null;
  private uiManager: UIManager;

  private constructor() {
    this.uiManager = UIManager.getInstance();
  }

  public static getInstance(): PageManager {
    if (!PageManager.instance) {
      PageManager.instance = new PageManager();
    }
    return PageManager.instance;
  }

  public setConfig(config: ServiceConfig): void {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (!this.config) {
      console.log('DEBUG: No service config available');
      return;
    }

    // Clean up any existing UI
    this.uiManager.cleanup();

    const items = await this.getContent();
    if (!items) {
      console.log('DEBUG: No content found on page');
      return;
    }

    this.injectUI(items);
  }

  async getContent(): Promise<QueueItem | QueueItem[] | null> {
    if (!this.config) {
      console.log('No service config found for this page');
      return null;
    }

    if (this.config.isSeries?.()) {
      console.log('Detected series page');
      const seriesData = await this.config.getSeriesData?.();
      return seriesData?.episodes || null;
    }

    // Handle single video content
    const titleElement = document.querySelector(this.config.titleSelector);
    if (!titleElement) {
      console.log('No title element found');
      return null;
    }

    return {
      id: Date.now().toString(),
      title: titleElement.textContent?.trim() || '',
      type: 'movie',
      url: window.location.href,
      service: this.config.name,
      thumbnailUrl: this.getThumbnailUrl() || '',
      addedAt: Date.now(),
      order: 0
    };
  }

  private injectUI(items: QueueItem | QueueItem[]): void {
    const itemsArray = Array.isArray(items) ? items : [items];
    
    // Add series-wide button if this is a series
    if (this.config?.isSeries?.()) {
      this.uiManager.createSeriesButton(itemsArray, this.config.name);
    }
    
    // Add individual video buttons
    itemsArray.forEach(item => {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        const container = video.parentElement;
        if (container) {
          this.uiManager.createAddButton(item, container, this.config?.name);
        }
      });

      // For Max, also add buttons to episode cards
      if (this.config?.name === 'max') {
        const episodeCards = document.querySelectorAll(this.config.episodeInfo?.containerSelector || '');
        episodeCards.forEach(card => {
          this.uiManager.createAddButton(item, card as HTMLElement, 'max');
        });
      }
    });
  }

  public cleanup(): void {
    this.uiManager.cleanup();
  }

  public destroy(): void {
    this.uiManager.destroy();
  }

  private getThumbnailUrl(): string | null {
    if (!this.config?.thumbnailSelector) return null;
    const thumbnailElement = document.querySelector(this.config.thumbnailSelector) as HTMLImageElement;
    return thumbnailElement?.src || null;
  }
} 