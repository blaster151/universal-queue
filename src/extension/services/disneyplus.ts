import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class DisneyPlusService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'disneyplus',
    urlPattern: '*://*.disneyplus.com/*',
    titleSelector: '[class*="title-field"], [class*="series-title"]',
    thumbnailSelector: '[class*="media-artwork"] img, [class*="title-image"] img',
    durationSelector: '[class*="duration-field"], [class*="progress-time"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      // Check for episode list or season selector
      return document.querySelector('[class*="episode-list"], [class*="season-selector"]') !== null;
    },
    episodeInfo: {
      containerSelector: '[class*="episode-item"]',
      titleSelector: '[class*="episode-title"]',
      numberSelector: '[class*="episode-number"]',
      synopsisSelector: '[class*="episode-description"]',
      durationSelector: '[class*="duration-field"]',
      progressSelector: '[class*="progress-bar"]'
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Disney+ typically uses width percentage for progress
    const style = progressElement.getAttribute('style');
    return style?.includes('width: 100%') || false;
  }

  protected parseDuration(duration: string): number | undefined {
    // Disney+ duration format: "1h 30m" or "30m"
    const hours = duration.match(/(\d+)h/)?.[1];
    const minutes = duration.match(/(\d+)m/)?.[1];
    
    if (hours && minutes) {
      return parseInt(hours) * 3600 + parseInt(minutes) * 60;
    } else if (minutes) {
      return parseInt(minutes) * 60;
    }
    return undefined;
  }
} 