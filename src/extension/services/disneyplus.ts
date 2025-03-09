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
    isSeries: () => {
      console.log('DisneyPlusService: Checking if series page...');
      const url = window.location.href;
      console.log('DisneyPlusService: Current URL:', url);

      // Check URL pattern - either series or browse
      const isSeriesUrl = url.includes('/series/');
      const isBrowseUrl = url.includes('/browse/');
      console.log('DisneyPlusService: URL check:', { isSeriesUrl, isBrowseUrl });

      // Log all potential elements for debugging
      console.log('DisneyPlusService: All h1 elements:', Array.from(document.querySelectorAll('h1')).map(el => ({
        text: el.textContent,
        className: el.className
      })));

      console.log('DisneyPlusService: All data-testid elements:', Array.from(document.querySelectorAll('[data-testid]')).map(el => ({
        testId: el.getAttribute('data-testid'),
        text: el.textContent,
        className: el.className
      })));

      // Check for series elements
      const hasTitle = !!document.querySelector('[data-testid="series-title"], h1');
      const hasSeasonSelector = !!document.querySelector('[data-testid="dropdown-button"]');
      const hasEpisodeContainer = !!document.querySelector('[data-testid="episode-container"]');
      const hasEpisodeItems = document.querySelectorAll('[data-testid="set-item"]').length > 0;
      const hasSeriesMetadata = !!document.querySelector('[data-testid="series-metadata"]');

      // Additional checks for browse page
      const hasSeriesHero = !!document.querySelector('[data-testid="series-hero"]');
      const hasSeriesDetails = !!document.querySelector('[data-testid="series-details"]');
      const hasSeriesDescription = !!document.querySelector('[data-testid="series-description"]');

      console.log('DisneyPlusService: Page elements:', {
        hasTitle,
        hasSeasonSelector,
        hasEpisodeContainer,
        hasEpisodeItems,
        hasSeriesMetadata,
        hasSeriesHero,
        hasSeriesDetails,
        hasSeriesDescription,
        episodeCount: document.querySelectorAll('[data-testid="set-item"]').length
      });

      // Consider it a series if we have any series-related elements
      const isSeries = hasTitle || hasSeasonSelector || hasEpisodeContainer || hasEpisodeItems || 
                      hasSeriesMetadata || hasSeriesHero || hasSeriesDetails || hasSeriesDescription;
      console.log('DisneyPlusService: Is series page?', isSeries);
      
      return isSeries;
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
      console.log('DisneyPlusService: Getting series data...');
      
      // Get series title
      const titleElement = document.querySelector(this.SELECTORS.series.title);
      const seriesTitle = titleElement?.textContent?.trim() || document.title;
      console.log('DisneyPlusService: Found series title:', seriesTitle);

      // Get series thumbnail
      const heroImage = document.querySelector(this.SELECTORS.series.thumbnail) as HTMLImageElement;
      const seriesThumbnail = heroImage?.src || '';
      console.log('DisneyPlusService: Found series thumbnail:', seriesThumbnail);

      // Get current season number from season selector
      const seasonSelector = document.querySelector(this.SELECTORS.series.seasonSelector);
      const seasonText = seasonSelector?.textContent?.trim() || '';
      const seasonNumber = seasonText ? parseInt(seasonText.match(/Season (\d+)/)?.[1] || '1') : 1;
      console.log('DisneyPlusService: Current season:', seasonNumber);

      // Find all episode elements
      console.log('DisneyPlusService: Looking for episode elements');
      const episodes = Array.from(document.querySelectorAll(this.SELECTORS.series.episodeItem));
      console.log('DisneyPlusService: Found episodes:', episodes.length);

      if (episodes.length === 0) {
        console.log('DisneyPlusService: No episodes found');
        throw new Error('No episodes found');
      }

      // Extract episode data
      console.log('DisneyPlusService: Extracting episode data...');
      const episodesData = episodes.map((episode, index) => {
        console.log(`DisneyPlusService: Processing episode ${index + 1}`);
        const info = this.getEpisodeInfo(episode);
        console.log('DisneyPlusService: Episode info:', info);
        
        return {
          ...info,
          id: episode.getAttribute('data-item-id') || Date.now().toString() + index,
          seriesId: window.location.pathname,
          seriesTitle,
          seasonNumber,
          type: 'episode' as const,
          service: 'disneyplus' as const,
          seriesThumbnailUrl: seriesThumbnail,
          addedAt: Date.now(),
          order: index
        } as EpisodeItem;
      });

      console.log('DisneyPlusService: Finished processing all episodes:', {
        totalEpisodes: episodesData.length,
        seriesTitle,
        seasonNumber
      });

      return {
        type: 'series',
        id: window.location.pathname,
        title: seriesTitle,
        service: 'disneyplus',
        thumbnailUrl: seriesThumbnail,
        seasonNumber,
        episodeCount: episodesData.length,
        episodes: episodesData,
        addedAt: Date.now()
      };
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