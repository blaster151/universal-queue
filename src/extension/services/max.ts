import { QueueItem, StreamingService, ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class MaxService extends BaseStreamingService {
  private readonly SELECTORS = {
    series: {
      title: '[class*="StyledTitle"]:not([class*="PrimaryTitle"]), [class*="StyledSeriesTitle"], h1',
      seasonSelector: '[class*="StyledSelectSort"]',
      episodeList: '[class*="StyledTileGrid"], [class*="StyledEpisodeList"], [class*="StyledEpisodeContainer"]',
      episodeItem: '[class*="StyledTileWrapper"], [class*="EpisodeTile"], [class*="episode-tile"]',
      thumbnail: '[class*="StyledImage"]',
      episodeTitle: '[class*="StyledPrimaryTitle"], [class*="StyledTitle"], [class*="episode-title"]',
      episodeDescription: '[class*="StyledDescription"], [class*="episode-description"]',
      episodeMetadata: '[class*="StyledMetadataContents"], [class*="episode-metadata"]',
      watchButton: 'button[class*="StyledBaseNativeButton"]',
      heroImage: '[class*="StyledHeroImage"] [class*="StyledImage"], [class*="StyledPosterImage"] [class*="StyledImage"]',
      progressBar: '[class*="StyledProgressBar"], [class*="progress-indicator"]',
      episodeNumber: '[class*="StyledEpisodeNumber"], [class*="episode-number"], [class*="EpisodeNumber"]'
    }
  };

  private readonly selectors = {
    episodeItem: '.StyledTileLinkNormal-Fuse-Web-Play__sc-1ramr47-33[href*="/video/watch/"]',
    episodeContainer: 'div[aria-label="Episodes"] #tileList',
    buttonContainer: '.StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31',
    episodeTitle: '[class*="StyledTitle"]',
    episodeNumber: '[class*="EpisodeNumber"]'
  };

  protected readonly config: ServiceConfig = {
    name: 'max' as StreamingService,
    urlPattern: '*://*.max.com/*',
    titleSelector: '[data-testid="content-title"]',
    thumbnailSelector: '[data-testid="content-thumbnail"]',
    durationSelector: '[data-testid="duration-text"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      // Check for series-specific elements
      const hasEpisodeList = document.querySelector('div[aria-label="Episodes"]');
      const hasSeasonSelector = document.querySelector('[data-testid="season-selector"]');
      const hasEpisodeGrid = document.querySelector('#tileList');
      
      console.log('Max: Series indicators:', {
        hasEpisodeList: !!hasEpisodeList,
        hasSeasonSelector: !!hasSeasonSelector,
        hasEpisodeGrid: !!hasEpisodeGrid
      });

      return !!(hasEpisodeList || hasSeasonSelector || hasEpisodeGrid);
    },
    isMovie: async () => {
      // Check for movie-specific elements and URL pattern
      const isMovieUrl = window.location.pathname.includes('/movie/') || window.location.pathname.includes('/watch/');
      const hasMovieDetails = document.querySelector('[class*="MovieDetails"], [class*="movie-details"]');
      const hasMovieMetadata = document.querySelector('[class*="MovieMetadata"], [class*="movie-metadata"]');
      const hasMovieTitle = document.querySelector('[class*="MovieTitle"], [class*="movie-title"]');
      
      console.log('Max: Movie indicators:', {
        isMovieUrl,
        hasMovieDetails: !!hasMovieDetails,
        hasMovieMetadata: !!hasMovieMetadata,
        hasMovieTitle: !!hasMovieTitle
      });

      return isMovieUrl || !!(hasMovieDetails || hasMovieMetadata || hasMovieTitle);
    },
    isList: async () => {
      // Check for list/browse page indicators
      const hasBrowseGrid = document.querySelector('[data-testid="browse-grid"]');
      const hasCollectionGrid = document.querySelector('[data-testid="collection-grid"]');
      const isCollectionUrl = window.location.pathname.includes('/collection/') || 
                             window.location.pathname.includes('/browse/');

      console.log('Max: List indicators:', {
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
      const seriesThumbnailUrl = document.querySelector(this.selectors.episodeTitle)?.getAttribute('src') || '';
      
      // Ensure episodes are EpisodeItems with all required fields
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
        type: 'series' as const,
        id: seriesId,
        title,
        service: 'max' as StreamingService,
        episodes: episodeItems,
        seasonNumber: 1,
        episodeCount,
        addedAt: Date.now(),
        url: window.location.href,
        thumbnailUrl: seriesThumbnailUrl
      };
    },
    episodeInfo: {
      containerSelector: 'div[aria-label="Episodes"] #tileList',
      titleSelector: '[class*="StyledTitle"]',
      numberSelector: '[class*="EpisodeNumber"]',
      synopsisSelector: '[class*="Synopsis"]',
      durationSelector: '[class*="Duration"]',
      progressSelector: '[class*="Progress"]'
    }
  };

  isSeries(): boolean {
    // First check if we're on a show page
    if (!window.location.pathname.includes('/show/')) {
      console.log('Max: Not a show page');
      return false;
    }

    // Check for episode items
    const episodeCount = document.querySelectorAll(this.selectors.episodeItem).length;
    console.log('Max: Found episode items:', episodeCount);

    // Check for the episodes container
    const hasEpisodesContainer = document.querySelector('div[aria-label="Episodes"]');
    console.log('Max: Has episodes container:', !!hasEpisodesContainer);

    return !!hasEpisodesContainer && episodeCount > 0;
  }

  async getSeriesData(): Promise<QueueItem[]> {
    console.log('Max: Starting getSeriesData');
    const episodes = Array.from(document.querySelectorAll<HTMLElement>(this.selectors.episodeItem));
    console.log('Max: Found episodes:', {
      count: episodes.length,
      selector: this.selectors.episodeItem,
      firstEpisode: episodes[0]?.outerHTML
    });

    const seriesId = window.location.pathname.split('/').pop() || '';
    console.log('Max: Series ID:', seriesId);
    const items: QueueItem[] = [];
    
    for (const episode of episodes) {
      const ariaLabel = episode.getAttribute('aria-label') || '';
      const href = episode.getAttribute('href') || '';
      console.log('Max: Processing episode:', {
        ariaLabel,
        href,
        html: episode.outerHTML
      });

      const match = ariaLabel.match(/Season (\d+), Episode (\d+): ([^.]+)/);
      
      if (!match) {
        console.warn('Max: Could not parse episode info from aria-label:', ariaLabel);
        // Try alternate parsing method
        const titleEl = episode.querySelector(this.selectors.episodeTitle);
        const numberEl = episode.querySelector(this.selectors.episodeNumber);
        console.log('Max: Attempting alternate parsing:', {
          titleElement: titleEl?.textContent,
          numberElement: numberEl?.textContent
        });
        continue;
      }

      const [, season, episodeNum, title] = match;
      const episodeId = href.split('/').pop() || '';
      const thumbnailUrl = episode.querySelector('img')?.src || '';
      
      console.log('Max: Creating episode item:', {
        episodeId,
        title,
        season,
        episodeNum,
        thumbnailUrl
      });

      items.push({
        id: episodeId,
        title: title.trim(),
        episodeNumber: parseInt(episodeNum, 10),
        seasonNumber: parseInt(season, 10),
        url: href,
        type: 'episode',
        service: 'max' as StreamingService,
        seriesId,
        thumbnailUrl,
        addedAt: Date.now()
      });
    }
    
    console.log('Max: Finished processing episodes:', {
      totalFound: items.length,
      items
    });
    
    return items;
  }

  public getConfig() {
    return this.config;
  }

  protected isEpisodeWatched(progressElement: Element): boolean {
    if (!progressElement) return false;
    
    // Check for aria-valuenow attribute first
    const progress = progressElement.getAttribute('aria-valuenow');
    if (progress) {
      const percent = parseInt(progress);
      return !isNaN(percent) && percent >= 95;
    }

    // Fallback to checking completed class
    return progressElement.classList.contains('completed');
  }

  protected parseDuration(duration: string): number | undefined {
    console.log('MaxService: Parsing duration:', duration);
    // Max format: "TV‑MA28m2011" - extract just the minutes
    const minutesMatch = duration.match(/(\d+)m/);
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : undefined;
    const seconds = minutes ? minutes * 60 : undefined;
    console.log('MaxService: Parsed duration:', seconds, 'seconds');
    return seconds;
  }

  protected getEpisodeInfo(episode: Element): Partial<QueueItem> {
    console.log('MaxService: Getting episode info for element:', {
      elementId: episode.id,
      className: episode.className,
      href: episode.getAttribute('href'),
      ariaLabel: episode.getAttribute('aria-label'),
      text: episode.textContent?.trim()
    });
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<QueueItem>;
    info.type = 'episode';
    
    // Get the episode-specific URL from the href or data attribute
    let url = episode.getAttribute('href');
    if (!url) {
      // Try to find link within the container
      const link = episode.querySelector('a[href*="/video/watch/"]');
      url = link?.getAttribute('href') || '';
    }
    
    if (url) {
      info.url = new URL(url, window.location.origin).href;
      console.log('MaxService: Found episode URL:', info.url);
    }

    // Extract episode number - try multiple approaches
    const numberElement = episode.querySelector(this.SELECTORS.series.episodeNumber);
    console.log('MaxService: Number element found:', {
      exists: !!numberElement,
      text: numberElement?.textContent,
      className: numberElement?.className
    });

    if (numberElement) {
      const numberText = numberElement.textContent?.trim() || '';
      const numberMatch = numberText.match(/(\d+)/);
      if (numberMatch) {
        info.episodeNumber = parseInt(numberMatch[1]);
        console.log('MaxService: Extracted episode number from element:', info.episodeNumber);
      }
    }

    // Try extracting from aria-label
    if (!info.episodeNumber && episode.getAttribute('aria-label')) {
      const ariaLabel = episode.getAttribute('aria-label') || '';
      const episodeMatch = ariaLabel.match(/Episode (\d+)/i);
      if (episodeMatch) {
        info.episodeNumber = parseInt(episodeMatch[1]);
        console.log('MaxService: Extracted episode number from aria-label:', info.episodeNumber);
      }
    }

    // Fallback to extracting from title if no dedicated number element
    if (!info.episodeNumber) {
      const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
      console.log('MaxService: Title element found:', {
        exists: !!titleElement,
        text: titleElement?.textContent,
        className: titleElement?.className
      });

      const titleText = titleElement?.textContent?.trim() || '';
      const episodeMatch = titleText.match(/E(\d+):|Episode (\d+)/i);
      if (episodeMatch) {
        info.episodeNumber = parseInt(episodeMatch[1] || episodeMatch[2]);
        info.title = titleText.split(':')[1]?.trim() || titleText;
        console.log('MaxService: Extracted episode info from title:', {
          number: info.episodeNumber,
          title: info.title
        });
      }
    }

    // Get thumbnail
    const thumbnailElement = episode.querySelector('img') as HTMLImageElement;
    if (thumbnailElement?.src) {
      info.thumbnailUrl = thumbnailElement.src;
      console.log('MaxService: Found thumbnail:', info.thumbnailUrl);
    }

    console.log('MaxService: Final episode info:', info);
    return info;
  }
} 