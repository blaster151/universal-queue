import { ServiceConfig, EpisodeItem } from '@/common/types';
import { BaseStreamingService } from './base';

export class DisneyPlusService extends BaseStreamingService {
  private readonly SELECTORS = {
    series: {
      seasonSelector: '[data-testid="dropdown-button"]',
      episodeItem: '[data-testid="set-item"]',
      title: '[data-testid="series-title"], h1',
      thumbnail: 'img[class*="jxvavs0"]',
      episodeTitle: '[data-testid="standard-regular-list-item-title"]',
      episodeDescription: '[data-testid="standard-regular-list-item-description"]',
      episodeMetadata: '[data-testid="standard-regular-list-metadata"]',
      progressIndicator: '[data-testid="progress-indicator"]'
    }
  };

  protected readonly config: ServiceConfig = {
    name: 'disneyplus',
    urlPattern: '*://*.disneyplus.com/*',
    titleSelector: '[data-testid="series-title"]',
    thumbnailSelector: '[data-testid="series-hero-image"]',
    durationSelector: '[data-testid="duration"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second delay between retries
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        console.log(`[DisneyPlusService] Checking if current page is a series (attempt ${attempt + 1}/${maxRetries})...`);
        
        const url = window.location.href;
        console.log(`[DisneyPlusService] Current URL: ${url}`);
        
        const hasSeriesPattern = url.includes('/series/') || url.includes('/browse/entity-');
        console.log(`[DisneyPlusService] URL contains series pattern: ${hasSeriesPattern}`);
        
        const episodeElements = document.querySelectorAll('[data-testid="set-item"]');
        console.log(`[DisneyPlusService] Found episode elements: ${episodeElements.length}`);
        
        const seasonSelector = document.querySelector('[data-testid="dropdown-button"]');
        console.log(`[DisneyPlusService] Found season selector: ${!!seasonSelector}`);
        
        const isSeries = hasSeriesPattern && (episodeElements.length > 0 || !!seasonSelector);
        console.log(`[DisneyPlusService] Current isSeries determination: ${isSeries}`);
        
        if (isSeries) {
          return true;
        }
        
        if (attempt < maxRetries - 1) {
          console.log(`[DisneyPlusService] Waiting ${retryDelay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      console.log('[DisneyPlusService] Final isSeries determination: false');
      return false;
    },
    episodeInfo: {
      containerSelector: '[data-testid="episode-container"]',
      titleSelector: '[data-testid="episode-title"]',
      numberSelector: '[data-testid="episode-number"]',
      synopsisSelector: '[data-testid="episode-synopsis"]',
      durationSelector: '[data-testid="episode-duration"]',
      progressSelector: '[data-testid="progress-indicator"]'
    },
    features: {
      expandList: {
        selector: '[data-testid="dropdown-button"]',
        action: 'click',
        waitForSelector: '[data-testid="episode-container"]'
      }
    },
    getSeriesData: async () => {
      console.log("[DisneyPlusService] Getting series data...");
      
      // Get series title
      const titleElement = document.querySelector('[data-testid="details-title-treatment"] img');
      const title = titleElement?.getAttribute('alt') || '';
      console.log("[DisneyPlusService] Found series title:", title);

      // Get series thumbnail
      const thumbnailUrl = titleElement?.getAttribute('src') || '';

      // Get episodes
      const episodeElements = document.querySelectorAll('[data-testid="set-item"]');
      console.log("[DisneyPlusService] Found", episodeElements.length, "episode elements");

      const episodes: EpisodeItem[] = [];
      episodeElements.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('[data-testid="standard-regular-list-item-title"]');
          const episodeTitle = titleElement?.textContent || '';
          console.log("[DisneyPlusService] Processing episode:", episodeTitle);

          // Extract episode number from title (e.g. "1. Pilot" -> 1)
          const episodeMatch = episodeTitle.match(/^(\d+)\./);
          const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : index + 1;
          console.log("[DisneyPlusService] Extracted episode number:", episodeNumber);

          const href = (element as HTMLAnchorElement).href;
          const id = href.split('/').pop() || '';
          
          episodes.push({
            id,
            type: 'episode',
            episodeNumber,
            title: episodeTitle,
            url: href,
            seriesId: window.location.pathname,
            seriesTitle: title,
            seasonNumber: 1, // Default to season 1 if not found
            service: 'disneyplus',
            thumbnailUrl: '',
            seriesThumbnailUrl: thumbnailUrl,
            addedAt: Date.now(),
            order: index
          });
        } catch (error) {
          console.error("[DisneyPlusService] Error processing episode:", error);
        }
      });

      console.log("[DisneyPlusService] Processed episodes:", episodes);

      return Promise.resolve({
        type: 'series',
        id: window.location.pathname,
        title,
        service: 'disneyplus',
        thumbnailUrl,
        seasonNumber: 1,
        episodeCount: episodes.length,
        episodes,
        addedAt: Date.now()
      });
    }
  };

  public getConfig(): ServiceConfig {
    return this.config;
  }

  protected getEpisodeInfo(episode: Element): Partial<EpisodeItem> {
    console.log('DisneyPlusService: Getting episode info for element:', episode.getAttribute('data-item-id'));
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<EpisodeItem>;
    info.type = 'episode';
    
    // Get the episode-specific URL from the href
    const url = episode.getAttribute('href');
    if (url) {
      info.url = new URL(url, window.location.origin).href;
      console.log('DisneyPlusService: Found episode URL:', info.url);
    }

    // Extract episode number from title
    const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
    const titleText = titleElement?.textContent?.trim() || '';
    const episodeMatch = titleText.match(/^(\d+)\./);
    if (episodeMatch) {
      info.episodeNumber = parseInt(episodeMatch[1]);
      console.log('DisneyPlusService: Extracted episode number:', info.episodeNumber);
    }

    // Get duration from aria label (more reliable than visible text)
    const ariaLabel = episode.getAttribute('aria-label');
    if (ariaLabel) {
      const durationMatch = ariaLabel.match(/\((\d+)m\)/);
      if (durationMatch) {
        info.duration = parseInt(durationMatch[1]) * 60;
        console.log('DisneyPlusService: Extracted duration:', info.duration);
      }
    }

    // Get thumbnail
    const thumbnailElement = episode.querySelector('img') as HTMLImageElement;
    if (thumbnailElement?.src) {
      info.thumbnailUrl = thumbnailElement.src;
      console.log('DisneyPlusService: Found thumbnail:', info.thumbnailUrl);
    }

    console.log('DisneyPlusService: Final episode info:', info);
    return info;
  }

  protected parseDuration(duration: string): number | undefined {
    console.log('DisneyPlusService: Parsing duration:', duration);
    // Disney+ format: "(44m)"
    const minutes = parseInt(duration.replace(/[()m]/g, ''));
    const seconds = !isNaN(minutes) ? minutes * 60 : undefined;
    console.log('DisneyPlusService: Parsed duration:', seconds, 'seconds');
    return seconds;
  }
} 