import { ServiceConfig, QueueItem } from '@/common/types';

export abstract class BaseStreamingService {
  protected abstract readonly config: ServiceConfig;

  public getConfig(): ServiceConfig {
    return this.config;
  }

  public isVideoPage(url: string): boolean {
    return new RegExp(this.config.urlPattern).test(url);
  }

  public isSeries(): boolean {
    return this.config.isSeries?.() || false;
  }

  public async getSeriesData(): Promise<QueueItem[]> {
    if (!this.config.getSeriesData) {
      return [];
    }
    return this.config.getSeriesData();
  }

  protected extractEpisodeData(element: Element): Partial<QueueItem> {
    if (!this.config.episodeInfo) {
      return {};
    }

    const {
      titleSelector,
      numberSelector,
      synopsisSelector,
      durationSelector,
      progressSelector
    } = this.config.episodeInfo;

    const title = element.querySelector(titleSelector)?.textContent?.trim();
    const numberText = element.querySelector(numberSelector)?.textContent?.trim();
    const synopsis = element.querySelector(synopsisSelector)?.textContent?.trim();
    const duration = element.querySelector(durationSelector)?.textContent?.trim();
    const progress = element.querySelector(progressSelector);

    // Parse episode number (e.g., "Episode 1" -> 1)
    const episodeNumber = numberText ? parseInt(numberText.match(/\d+/)?.[0] || '0') : undefined;

    return {
      title,
      synopsis,
      duration: duration ? this.parseDuration(duration) : undefined,
      episodeNumber,
      isWatched: progress ? this.isEpisodeWatched(progress) : false
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
} 