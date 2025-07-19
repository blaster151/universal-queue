import { ServiceConfig, EpisodeItem, StreamingService } from '@/common/types';
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
    name: 'disneyplus' as StreamingService,
    urlPattern: '*://*.disneyplus.com/*',
    titleSelector: '[data-testid="series-title"]',
    thumbnailSelector: '[data-testid="series-thumbnail"]',
    durationSelector: '[data-testid="duration-text"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      // Check for series-specific elements
      const hasEpisodeList = document.querySelector('[data-testid="episode-list"]');
      const hasSeasonSelector = document.querySelector('[data-testid="season-selector"]');
      const hasEpisodeGrid = document.querySelector('[data-testid="episode-grid"]');
      
      console.log('Disney+: Series indicators:', {
        hasEpisodeList: !!hasEpisodeList,
        hasSeasonSelector: !!hasSeasonSelector,
        hasEpisodeGrid: !!hasEpisodeGrid
      });

      return !!(hasEpisodeList || hasSeasonSelector || hasEpisodeGrid);
    },
    isMovie: async () => {
      // Check for movie-specific elements with more flexible selectors
      const hasMovieDetails = !!document.querySelector('[data-testid="details-container"], [data-testid="movie-details"], [class*="details-container"], [class*="MovieDetails"]');
      const hasMovieMetadata = !!document.querySelector('[data-testid="metadata-container"], [data-testid="movie-metadata"], [class*="metadata-container"], [class*="MovieMetadata"]');
      const hasMovieRating = !!document.querySelector('[data-testid="content-rating-score"], [data-testid="movie-rating"], [class*="content-rating"], [class*="Rating"]');
      const hasMovieDuration = !!document.querySelector('[data-testid="runtime-metadata"], [data-testid="movie-duration"], [class*="runtime"], [class*="Duration"]');
      const hasPlayButton = !!document.querySelector('[data-testid="play-button"], button[class*="play"], [class*="PlayButton"]');
      const hasMovieTitle = !!document.querySelector('[data-testid="movie-title"], [class*="MovieTitle"]');
      
      // Check URL pattern as well
      const isMovieUrl = window.location.pathname.includes('/movie/') || window.location.pathname.includes('/movies/');
      
      console.log('Disney+: Movie indicators:', {
        hasMovieDetails,
        hasMovieMetadata,
        hasMovieRating,
        hasMovieDuration,
        hasPlayButton,
        hasMovieTitle,
        isMovieUrl
      });

      // More flexible conditions: any two indicators or play button with any other indicator
      const indicators = [hasMovieDetails, hasMovieMetadata, hasMovieRating, hasMovieDuration, hasMovieTitle];
      const hasMultipleIndicators = indicators.filter(Boolean).length >= 2;
      const hasPlayWithIndicator = hasPlayButton && indicators.some(Boolean);

      // Don't check for series indicators, as some movies might be part of collections
      return isMovieUrl || hasPlayWithIndicator || hasMultipleIndicators;
    },
    isList: async () => {
      // Check for list/browse page indicators
      const hasBrowseGrid = document.querySelector('[data-testid="browse-grid"]');
      const hasCollectionGrid = document.querySelector('[data-testid="collection-grid"]');
      const isCollectionUrl = window.location.pathname.includes('/collection/');

      console.log('Disney+: List indicators:', {
        hasBrowseGrid: !!hasBrowseGrid,
        hasCollectionGrid: !!hasCollectionGrid,
        isCollectionUrl
      });

      return !!(hasBrowseGrid || hasCollectionGrid || isCollectionUrl);
    },
    episodeInfo: {
      containerSelector: '[data-testid="episode-list"]',
      titleSelector: '[data-testid="episode-title"]',
      numberSelector: '[data-testid="episode-number"]',
      synopsisSelector: '[data-testid="episode-synopsis"]',
      durationSelector: '[data-testid="duration-text"]',
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