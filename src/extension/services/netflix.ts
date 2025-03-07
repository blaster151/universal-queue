import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class NetflixService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'netflix',
    urlPattern: '*://*.netflix.com/*',
    titleSelector: '[data-uia="video-title"]',
    thumbnailSelector: '.previewModal--boxart img, .hero-image-wrapper img',
    durationSelector: '[data-uia="controls-time-remaining"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      return document.querySelector('[class*="episode-item"]') !== null;
    },
    episodeInfo: {
      containerSelector: '[class*="episode-item"]',
      titleSelector: '[class*="episode-title"]',
      numberSelector: '[class*="episode-number"]',
      synopsisSelector: '[class*="synopsis"]',
      durationSelector: '[class*="duration"]',
      progressSelector: '[role="progressbar"]'
    },
    features: {
      expandList: {
        selector: '[data-uia="expand-episodes"], button[aria-label*="episodes"]',
        action: 'click',
        waitForSelector: '[class*="episode-item"]'
      }
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Netflix uses a red progress bar (rgb(229, 9, 20)) for watched episodes
    const style = progressElement.getAttribute('style');
    return style?.includes('rgb(229, 9, 20)') || false;
  }

  protected parseDuration(duration: string): number | undefined {
    // Netflix duration format: "1h 30m" or "30m"
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