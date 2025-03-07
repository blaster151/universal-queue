import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class AppleTVService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'appletv',
    urlPattern: '*://*.tv.apple.com/*',
    titleSelector: '[class*="video-title"], [class*="show-title"]',
    thumbnailSelector: '[class*="artwork-image"]',
    durationSelector: '[class*="time-remaining"], [class*="duration"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      return document.querySelector('[class*="episode-list"], [class*="season-picker"]') !== null;
    },
    episodeInfo: {
      containerSelector: '[class*="episode-item"]',
      titleSelector: '[class*="episode-title"]',
      numberSelector: '[class*="episode-number"]',
      synopsisSelector: '[class*="episode-description"]',
      durationSelector: '[class*="episode-duration"]',
      progressSelector: '[class*="progress-indicator"]'
    },
    features: {
      expandList: {
        selector: '[class*="show-more"], button[class*="expand-episodes"]',
        action: 'click',
        waitForSelector: '[class*="episode-item"]'
      }
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Apple TV+ typically uses a progress indicator with aria attributes
    return progressElement.getAttribute('aria-valuenow') === '100' ||
           progressElement.classList.contains('completed');
  }

  protected parseDuration(duration: string): number | undefined {
    // Apple TV+ format: "1 hr 30 min" or "30 min"
    const hours = duration.match(/(\d+)\s*hr/)?.[1];
    const minutes = duration.match(/(\d+)\s*min/)?.[1];
    
    if (hours && minutes) {
      return parseInt(hours) * 3600 + parseInt(minutes) * 60;
    } else if (minutes) {
      return parseInt(minutes) * 60;
    }
    return undefined;
  }
} 