import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class NetflixService extends BaseStreamingService {
  public getConfig(): ServiceConfig {
    console.log('NetflixService: Getting config');
    return {
      name: 'netflix',
      urlPattern: '*://*.netflix.com/*',
      titleSelector: '.titleCard--container h3, .titleCard--container img[alt]',
      thumbnailSelector: '.previewModal--boxart img, .hero-image-wrapper img',
      completionDetector: {
        type: 'event',
        value: 'video.ended'
      },
      isSeries: () => {
        console.log('NetflixService: Checking if series');
        const isSeries = document.querySelector('.titleCardList--container.episode-item') !== null;
        console.log('NetflixService: Is series?', isSeries);
        return isSeries;
      },
      getSeriesData: async () => {
        console.log('NetflixService: Getting series data');
        const episodes = document.querySelectorAll('.titleCardList--container.episode-item');
        console.log('NetflixService: Found episodes:', episodes.length);
        
        if (episodes.length === 0) {
          console.log('NetflixService: No episodes found');
          return [];
        }

        const seriesData = Array.from(episodes).map((episode, index) => {
          const titleElement = episode.querySelector('img[alt]');
          const thumbnailElement = episode.querySelector('img');
          console.log('NetflixService: Episode', index + 1, 'title:', titleElement?.getAttribute('alt'));
          
          return {
            id: Date.now().toString() + index,
            title: titleElement?.getAttribute('alt')?.trim() || '',
            type: 'episode' as const,
            url: window.location.href,
            service: 'netflix' as const,
            thumbnailUrl: thumbnailElement?.src || '',
            addedAt: Date.now(),
            order: index
          };
        });

        console.log('NetflixService: Series data:', seriesData);
        return seriesData;
      }
    };
  }

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
      console.log('NetflixService: Checking if series');
      const isSeries = document.querySelector('[data-uia="episode-list"]') !== null;
      console.log('NetflixService: Is series?', isSeries);
      return isSeries;
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
    },
    getSeriesData: async () => {
      console.log('NetflixService: Getting series data');
      const episodes = document.querySelectorAll('[data-uia="episode-item"]');
      console.log('NetflixService: Found episodes:', episodes.length);
      
      if (episodes.length === 0) {
        console.log('NetflixService: No episodes found');
        return [];
      }

      const seriesData = Array.from(episodes).map((episode, index) => {
        const titleElement = episode.querySelector('[data-uia="episode-title"]');
        const thumbnailElement = episode.querySelector('img');
        console.log('NetflixService: Episode', index + 1, 'title:', titleElement?.textContent);
        
        return {
          id: Date.now().toString() + index,
          title: titleElement?.textContent?.trim() || '',
          type: 'episode' as const,
          url: window.location.href,
          service: 'netflix' as const,
          thumbnailUrl: thumbnailElement?.src || '',
          addedAt: Date.now(),
          order: index
        };
      });

      console.log('NetflixService: Series data:', seriesData);
      return seriesData;
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