import { ServiceConfig, QueueItem } from '@/common/types';

export abstract class BaseStreamingService {
  protected abstract readonly config: ServiceConfig;

  public getConfig(): ServiceConfig {
    return this.config;
  }

  public isVideoPage(url: string): boolean {
    return new RegExp(this.config.urlPattern).test(url);
  }

  public async checkIsSeries(): Promise<boolean> {
    const result = await this.config.isSeries();
    return result || false;
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