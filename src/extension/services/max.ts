import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class MaxService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'max',
    urlPattern: '*://*.max.com/*',
    titleSelector: '[data-testid="VideoTitle"], .video-title',
    thumbnailSelector: '[data-testid="hero-image"] img, [data-testid="title-card-image"]',
    durationSelector: '.video-duration, [data-testid="duration"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      return document.querySelector('[data-testid="episodes-panel"], [data-testid="season-selector"]') !== null;
    },
    episodeInfo: {
      containerSelector: '[data-testid="episode-card"]',
      titleSelector: '[data-testid="episode-title"]',
      numberSelector: '[data-testid="episode-number"]',
      synopsisSelector: '[data-testid="episode-synopsis"]',
      durationSelector: '[data-testid="episode-duration"]',
      progressSelector: '[data-testid="progress-indicator"]'
    },
    features: {
      expandList: {
        selector: '[data-testid="show-more"], button[class*="expand-episodes"]',
        action: 'click',
        waitForSelector: '[data-testid="episode-card"]'
      }
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Max typically uses a filled progress indicator
    return progressElement.classList.contains('completed') || 
           progressElement.getAttribute('aria-valuenow') === '100';
  }

  protected parseDuration(duration: string): number | undefined {
    // Max format: "1 hr 30 min" or "30 min"
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