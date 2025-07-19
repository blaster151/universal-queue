import { QueueItem, StreamingService, ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class HuluService extends BaseStreamingService {
  readonly selectors = {
    episodeItem: 'div[data-testid="seh-tile"]',
    episodeContainer: 'div[data-testid="visible-collection-impression"]',
    buttonContainer: '.uq-button-container',
    episodeTitle: '[data-testid="seh-tile-content-title"]',
    episodeNumber: '[data-testid="episode-number"], [class*="EpisodeNumber"], h3._6bueqf6',
    episodeDescription: '[data-testid="standard-emphasis-tile-description"]',
    thumbnail: '[data-testid="image"]',
    watchButton: '[data-testid="watchaction-btn"]',
    duration: '[data-testid="episode-duration"], [class*="Duration"]',
    progressBar: '[data-testid="episode-progress"], [class*="progress"], [role="progressbar"]'
  };

  protected readonly config: ServiceConfig = {
    name: 'hulu' as StreamingService,
    urlPattern: '*://*.hulu.com/*',
    titleSelector: '[data-testid="details-title"]',
    thumbnailSelector: '[data-testid="content-lockup-img"]',
    durationSelector: '[data-testid="duration-text"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      // Check for series-specific elements with more flexible selectors
      const hasEpisodeList = !!document.querySelector('[data-testid="seh-episodes-list"], [class*="episode-list"], [class*="EpisodeList"]');
      const hasSeasonSelector = !!document.querySelector('[data-testid="season-selector"], [class*="season-selector"], [class*="SeasonSelector"]');
      const hasEpisodeGrid = !!document.querySelector('[data-testid="episode-grid"], [class*="episode-grid"], [class*="EpisodeGrid"]');
      const hasSeasonPicker = !!document.querySelector('[class*="season-picker"], [class*="SeasonPicker"]');
      const hasEpisodeContainer = !!document.querySelector('[data-testid="visible-collection-impression"], [class*="episode-container"]');
      
      // Check URL pattern as well
      const isSeriesUrl = window.location.pathname.includes('/series/');
      
      console.log('Hulu: Series indicators:', {
        hasEpisodeList,
        hasSeasonSelector,
        hasEpisodeGrid,
        hasSeasonPicker,
        hasEpisodeContainer,
        isSeriesUrl
      });

      // More flexible condition: URL match or any series indicator
      return isSeriesUrl || hasEpisodeList || hasSeasonSelector || hasEpisodeGrid || hasSeasonPicker || hasEpisodeContainer;
    },
    isMovie: async () => {
      // Check for movie-specific elements
      const hasMovieDetails = document.querySelector('[data-testid="movie-details"]');
      const hasMovieMetadata = document.querySelector('[data-testid="movie-meta-data"]');
      const hasPlayButton = document.querySelector('[data-testid="play-button"]');
      
      // Make sure we don't have series elements
      const hasSeriesElements = document.querySelector('[data-testid="seh-episodes-list"], [data-testid="season-selector"], [data-testid="episode-grid"]');

      console.log('Hulu: Movie indicators:', {
        hasMovieDetails: !!hasMovieDetails,
        hasMovieMetadata: !!hasMovieMetadata,
        hasPlayButton: !!hasPlayButton,
        hasSeriesElements: !!hasSeriesElements
      });

      return !hasSeriesElements && !!(hasMovieDetails || hasMovieMetadata || hasPlayButton);
    },
    isList: async () => {
      // Check for list/browse page indicators
      const hasBrowseGrid = document.querySelector('[data-testid="browse-grid"]');
      const hasCollectionGrid = document.querySelector('[data-testid="collection-grid"]');
      const isCollectionUrl = window.location.pathname.includes('/collection/') || 
                             window.location.pathname.includes('/browse/');

      console.log('Hulu: List indicators:', {
        hasBrowseGrid: !!hasBrowseGrid,
        hasCollectionGrid: !!hasCollectionGrid,
        isCollectionUrl
      });

      return !!(hasBrowseGrid || hasCollectionGrid || isCollectionUrl);
    },
    getSeriesData: async () => {
      const episodes = await this.getSeriesData();
      const seriesId = window.location.pathname.split('/').pop() || 'unknown';
      const title = document.title.split(' - ')[0] || 'Unknown Series';
      const episodeCount = episodes.length;
      const seriesThumbnailUrl = document.querySelector(this.selectors.thumbnail)?.getAttribute('src') || '';
      
      // Convert episodes to EpisodeItems by ensuring required fields
      const episodeItems = episodes
        .filter(ep => ep.seasonNumber !== undefined && ep.episodeNumber !== undefined)
        .map((ep, index) => ({
          ...ep,
          type: 'episode' as const,
          seriesId,
          seriesTitle: title,
          seasonNumber: ep.seasonNumber!,
          episodeNumber: ep.episodeNumber!,
          seriesThumbnailUrl,
          order: index
        }));
      
      return {
        type: 'series',
        id: seriesId,
        title,
        service: 'hulu' as StreamingService,
        episodes: episodeItems,
        seasonNumber: 1,
        episodeCount,
        addedAt: Date.now(),
        url: window.location.href,
        thumbnailUrl: seriesThumbnailUrl
      };
    },
    episodeInfo: {
      containerSelector: '[data-testid="seh-episodes-list"]',
      titleSelector: '[data-testid="seh-tile-content-title"]',
      numberSelector: '[data-testid="episode-number"]',
      synopsisSelector: '[data-testid="seh-tile-content-description"]',
      durationSelector: '[data-testid="duration-text"]',
      progressSelector: '[data-testid="progress-indicator"]'
    }
  };

  isSeries(): boolean {
    // First check if we're on a series page
    if (!window.location.pathname.includes('/series/')) {
      console.log('Hulu: Not a series page');
      return false;
    }

    // Check for episode items
    const episodeCount = document.querySelectorAll(this.selectors.episodeItem).length;
    console.log('Hulu: Found episode items:', episodeCount);

    // Check for the episodes container
    const hasEpisodesContainer = document.querySelector(this.selectors.episodeContainer);
    console.log('Hulu: Has episodes container:', !!hasEpisodesContainer);

    return !!hasEpisodesContainer && episodeCount > 0;
  }

  async getSeriesData(): Promise<QueueItem[]> {
    console.log('Hulu: Starting getSeriesData');
    const episodes = Array.from(document.querySelectorAll<HTMLElement>(this.selectors.episodeItem));
    console.log('Hulu: Found episodes:', {
      count: episodes.length,
      selector: this.selectors.episodeItem,
      firstEpisode: episodes[0]?.outerHTML
    });

    const items: QueueItem[] = [];
    
    for (const episode of episodes) {
      const titleElement = episode.querySelector(this.selectors.episodeTitle);
      const numberElement = episode.querySelector(this.selectors.episodeNumber);
      const thumbnailElement = episode.querySelector(this.selectors.thumbnail) as HTMLImageElement;
      const watchButton = episode.querySelector(this.selectors.watchButton) as HTMLAnchorElement;

      if (!titleElement || !numberElement || !watchButton) {
        console.warn('Hulu: Missing required elements for episode');
        continue;
      }

      const title = titleElement.textContent?.trim() || '';
      const numberText = numberElement.textContent?.trim() || '';
      const thumbnailUrl = thumbnailElement?.src || '';
      const href = watchButton.getAttribute('href') || '';
      
      // Extract episode number from text like "episode 1"
      const episodeMatch = numberText.match(/episode (\d+)/i);
      const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : undefined;
      
      console.log('Hulu: Processing episode:', {
        title,
        numberText,
        episodeNumber,
        thumbnailUrl,
        href
      });

      if (!episodeNumber) {
        console.warn('Hulu: Could not parse episode number from:', numberText);
        continue;
      }

      const seriesId = window.location.pathname.split('/').pop() || 'unknown';
      const seriesTitle = document.title.split(' - ')[0] || 'Unknown Series';
      const seriesThumbnailUrl = document.querySelector(this.selectors.thumbnail)?.getAttribute('src') || '';

      items.push({
        id: href.split('/').pop() || '',
        title: title.trim(),
        episodeNumber,
        seasonNumber: 1,
        url: new URL(href, window.location.origin).href,
        type: 'episode' as const,
        service: 'hulu' as StreamingService,
        seriesId,
        seriesTitle,
        seriesThumbnailUrl,
        thumbnailUrl,
        order: items.length,
        addedAt: Date.now()
      });
    }
    
    console.log('Hulu: Finished processing episodes:', {
      totalFound: items.length,
      items
    });
    
    return items;
  }

  public getConfig() {
    return this.config;
  }

  protected getEpisodeInfo(episode: Element): Partial<QueueItem> {
    console.log('Hulu: Getting episode info for element:', {
      elementId: episode.id,
      className: episode.className
    });
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<QueueItem>;
    info.type = 'episode';
    
    // Get the episode-specific URL from the watch button
    const watchButton = episode.querySelector(this.selectors.watchButton) as HTMLAnchorElement;
    if (watchButton?.href) {
      info.url = new URL(watchButton.href, window.location.origin).href;
      console.log('Hulu: Found episode URL:', info.url);
    }

    // Get episode number
    const numberElement = episode.querySelector(this.selectors.episodeNumber);
    if (numberElement) {
      const numberText = numberElement.textContent?.trim() || '';
      const episodeMatch = numberText.match(/episode (\d+)/i);
      if (episodeMatch) {
        info.episodeNumber = parseInt(episodeMatch[1]);
        console.log('Hulu: Extracted episode number:', info.episodeNumber);
      }
    }

    // Get thumbnail
    const thumbnailElement = episode.querySelector(this.selectors.thumbnail) as HTMLImageElement;
    if (thumbnailElement?.src) {
      info.thumbnailUrl = thumbnailElement.src;
      console.log('Hulu: Found thumbnail:', info.thumbnailUrl);
    }

    console.log('Hulu: Final episode info:', info);
    return info;
  }

  protected parseDuration(duration: string): number | undefined {
    console.log('Hulu: Parsing duration:', duration);
    // Hulu format: "1h 30m" or "30m"
    const hours = duration.match(/(\d+)\s*h/)?.[1];
    const minutes = duration.match(/(\d+)\s*m/)?.[1];
    
    if (hours && minutes) {
      return parseInt(hours) * 3600 + parseInt(minutes) * 60;
    } else if (minutes) {
      return parseInt(minutes) * 60;
    }
    return undefined;
  }

  protected isEpisodeWatched(progressElement: Element): boolean {
    if (!progressElement) return false;
    
    // Check for width style (percentage)
    const style = progressElement.getAttribute('style');
    const widthMatch = style?.match(/width:\s*(\d+)%/);
    if (widthMatch) {
      const percent = parseInt(widthMatch[1]);
      return !isNaN(percent) && percent >= 95;
    }

    // Check for aria-valuenow
    const progress = progressElement.getAttribute('aria-valuenow');
    if (progress) {
      const percent = parseInt(progress);
      return !isNaN(percent) && percent >= 95;
    }

    // Check for completed class
    return progressElement.classList.contains('completed');
  }
} 