import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class HuluService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'hulu',
    urlPattern: '*://*.hulu.com/*',
    titleSelector: '.PlayerMetadata__title, .Details__title',
    thumbnailSelector: '.CoverArt__image, .SimpleModalImage__image',
    durationSelector: '.TimeIndicator__time, .Duration__text',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      return document.querySelector('.EpisodeList, .SeasonSelector') !== null;
    },
    episodeInfo: {
      containerSelector: '.EpisodeTile',
      titleSelector: '.EpisodeTile__title',
      numberSelector: '.EpisodeTile__number',
      synopsisSelector: '.EpisodeTile__description',
      durationSelector: '.EpisodeTile__duration',
      progressSelector: '.EpisodeTile__progress'
    },
    features: {
      expandList: {
        selector: '.EpisodeList__expandButton, button[class*="show-more"]',
        action: 'click',
        waitForSelector: '.EpisodeTile'
      }
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // Hulu typically uses a progress bar with width percentage
    const style = progressElement.getAttribute('style');
    return style?.includes('width: 100%') || 
           progressElement.classList.contains('EpisodeTile__progress--complete');
  }

  protected parseDuration(duration: string): number | undefined {
    // Hulu format: "1 hr 30 min" or "30 min"
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