import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class PrimeVideoService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'primevideo',
    urlPattern: '*://*.primevideo.com/*',
    titleSelector: '[data-automation-id="title"], .atvwebplayersdk-title-text',
    thumbnailSelector: '[data-automation-id="thumbnail"], .av-bgimg__div',
    durationSelector: '.atvwebplayersdk-timeindicator-text',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      // Check for episode list or season selector
      return document.querySelector('[data-automation-id="episode-list"], [data-automation-id="season-selector"]') !== null;
    },
    episodeInfo: {
      containerSelector: '[data-automation-id="episode-item"]',
      titleSelector: '[data-automation-id="episode-title"]',
      numberSelector: '[data-automation-id="episode-number"]',
      synopsisSelector: '[data-automation-id="episode-synopsis"]',
      durationSelector: '[data-automation-id="episode-runtime"]',
      progressSelector: '.progressBar'
    },
    features: {
      expandList: {
        selector: '[data-automation-id="show-more"], button[class*="show-more"]',
        action: 'click',
        waitForSelector: '[data-automation-id="episode-item"]'
      }
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Prime Video uses width percentage for progress
    const style = progressElement.getAttribute('style');
    return style?.includes('width: 100%') || false;
  }

  protected parseDuration(duration: string): number | undefined {
    // Prime Video format: "1 h 30 min" or "30 min"
    const hours = duration.match(/(\d+)\s*h/)?.[1];
    const minutes = duration.match(/(\d+)\s*min/)?.[1];
    
    if (hours && minutes) {
      return parseInt(hours) * 3600 + parseInt(minutes) * 60;
    } else if (minutes) {
      return parseInt(minutes) * 60;
    }
    return undefined;
  }
} 