import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class NetflixService extends BaseStreamingService {
  private readonly SELECTORS = {
    series: {
      container: '[data-uia="episode-list"], .episodeSelector',
      episodeItem: [
        // Primary episode selectors
        '[data-uia="episode-item"]',
        // Fallback to more specific episode containers
        'li[class*="episode-item"]',
        'div[class*="episode-item"]',
        // Only use these if they contain episode-specific elements
        '.titleCard--container:has([data-uia="episode-title"])',
        '.titleCardList--container:has([data-uia="episode-title"])'
      ].join(', '),
      expandButton: [
        // Netflix's section divider expand button
        'button[data-uia="section-expand"]',
        'button[aria-label="expand section"]',
        '.section-divider button',
        // Fallback selectors
        'button[class*="section-expandButton"]',
        'button[class*="expandButton"]',
        // Legacy selectors
        '[data-uia="expand-episodes"]',
        'button[aria-label*="episodes"]',
        'button[aria-label*="Episodes"]'
      ].join(', '),
      seriesIndicators: [
        // Various ways to detect if it's a series
        '.about-header h3.previewModal--section-header',
        '.episode-list',
        '.episodeSelector',
        '[data-uia="episode-list"]',
        '[data-uia="expand-episodes"]',
        'button[aria-label*="episodes"]',
        'button[aria-label*="Episodes"]',
        // Genre indicators
        'a[href*="/browse/m/genre/83"]', // TV Shows
        '[data-uia="previewModal--tags-genre"] a[href*="TV"]', // Links containing TV
        // Additional series indicators
        '.previewModal--season-label',
        '.seasonSelector',
        '.episode-selector'
      ].join(', '),
      title: [
        // Story art image alt text
        '.playerModel--player__storyArt[alt]',
        // About section header (multiple variations)
        '.previewModal--section-header strong',
        '.about-header .previewModal--section-header strong',
        // Video title
        '[data-uia="video-title"]',
        // Player title treatment
        '.previewModal--player-titleTreatment h4'
      ].join(', '),
      thumbnail: '.previewModal--boxart img, .hero-image-wrapper img, .playerModel--player__storyArt',
      seasonInfo: [
        // Various season info selectors
        '.season-info',
        '.previewModal--season-label',
        '[data-uia="season-label"]',
        '.seasonSelector button[aria-selected="true"]'
      ].join(', '),
      episodeTitle: [
        // Primary title selectors (short titles)
        '[data-uia="episode-title"]:not([class*="synopsis"])',
        '.titleCard-title_text:not([class*="synopsis"])',
        // Netflix specific title selectors
        '.episode-title h3:not([class*="synopsis"])',
        '.titleCard h3:not([class*="synopsis"])',
        // Fallback selectors
        'h3[class*="title"]:not([class*="synopsis"])',
        'h4[class*="title"]:not([class*="synopsis"])'
      ].join(', '),
      episodeDescription: [
        // Synopsis/description selectors
        '[data-uia="episode-synopsis"]',
        '.titleCard-synopsis',
        '.episode-synopsis',
        '[class*="synopsis"]'
      ].join(', '),
      episodeNumber: [
        // Primary number selectors
        '[data-uia="episode-number"]',
        // Specific Netflix number selectors
        '.titleCard-episode',
        '.episode-number',
        // Fallback selectors
        '[class*="episode-number"]',
        '[class*="episodeNumber"]'
      ].join(', '),
      episodeThumbnail: [
        // Primary thumbnail selectors
        'img.previewModal--boxart',
        'img.titleCard-imageWrapper',
        // Fallback selectors
        'img[class*="boxart"]',
        'img[class*="titleCard"]',
        'img[alt*="Episode"]'
      ].join(', '),
      duration: [
        // Various duration selectors
        '[data-uia="episode-runtime"]',
        '.duration',
        '.episode-runtime',
        '.runtime'
      ].join(', '),
      progress: [
        // Various progress selectors
        '[data-uia="episode-progress"]',
        'progress.titleCard-progress',
        '.progress-bar',
        '.episode-progress'
      ].join(', '),
      showMoreButton: [
        '[data-uia="expand-to-show-more"]',
        'button[aria-label*="Show More"]',
        'button[class*="showMore"]',
        'button.episodeSelector-season-trigger'
      ].join(', ')
    }
  };

  private getSeriesTitle(): string {
    console.log('NetflixService: Getting series title');
    
    // Try window title first (most reliable)
    const windowTitle = document.title;
    if (windowTitle.includes(' - Netflix')) {
      const title = windowTitle.replace(' - Netflix', '').trim();
      console.log('NetflixService: Found title in window title:', title);
      return title;
    }

    // Try DOM selectors
    for (const selector of this.SELECTORS.series.title.split(', ')) {
      const element = document.querySelector(selector);
      if (element) {
        const title = element.tagName.toLowerCase() === 'img' 
          ? element.getAttribute('alt')
          : element.textContent?.trim();
        if (title) {
          console.log('NetflixService: Found title with selector', selector, ':', title);
          return title;
        }
      }
    }

    // Try About section with more specific targeting
    const aboutHeader = document.querySelector('.about-header h3.previewModal--section-header');
    if (aboutHeader) {
      const strongElement = aboutHeader.querySelector('strong');
      if (strongElement) {
        const title = strongElement.textContent?.trim();
        if (title) {
          console.log('NetflixService: Found title in About section:', title);
          return title;
        }
      } else {
        // Sometimes the text might be directly in the h3
        const text = aboutHeader.textContent?.trim();
        if (text?.startsWith('About ')) {
          const title = text.replace('About ', '').trim();
          console.log('NetflixService: Found title in About section text:', title);
          return title;
        }
      }
    }

    console.log('NetflixService: No title found, using default');
    return 'Unknown Series';
  }

  private async expandEpisodeList(): Promise<void> {
    console.log('NetflixService: Attempting to expand episode list');
    
    // Try to find the section divider button
    const expandButton = document.querySelector(this.SELECTORS.series.expandButton);
    if (expandButton instanceof HTMLElement) {
      console.log('NetflixService: Found expand button:', expandButton.className);
      
      // Check if the section is already expanded
      const isCollapsed = expandButton.closest('.section-divider')?.classList.contains('collapsed');
      if (isCollapsed) {
        console.log('NetflixService: Section is collapsed, clicking expand button');
        expandButton.click();
        
        // Wait for episodes to load with increasing timeouts
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          const episodes = document.querySelectorAll(this.SELECTORS.series.episodeItem);
          if (episodes.length > 10) { // We expect more than the initial 10 episodes
            console.log('NetflixService: Additional episodes loaded:', episodes.length);
            return;
          }
        }
        console.log('NetflixService: No additional episodes found after expanding');
      } else {
        console.log('NetflixService: Section is already expanded');
      }
    } else {
      console.log('NetflixService: No expand button found');
    }

    // Check if we have episodes even without expanding
    const episodes = document.querySelectorAll(this.SELECTORS.series.episodeItem);
    console.log('NetflixService: Found episodes without expanding:', episodes.length);
  }

  private getEpisodeInfo(episode: Element): { number: number; title: string | undefined; thumbnail: string | undefined; duration: number | undefined; url: string | undefined } {
    console.log('NetflixService: Getting episode info for element:', episode.className);
    
    let number = -1;
    let title: string | undefined;
    let thumbnail: string | undefined;
    let duration: number | undefined;
    let url: string | undefined;

    // Try to get thumbnail
    const thumbnailElement = episode.querySelector(this.SELECTORS.series.episodeThumbnail) as HTMLImageElement;
    if (thumbnailElement?.src) {
      thumbnail = thumbnailElement.src;
      console.log('NetflixService: Found thumbnail:', thumbnail);
    }

    // Try to get episode number from dedicated element first
    const numberElement = episode.querySelector(this.SELECTORS.series.episodeNumber);
    if (numberElement) {
      const text = numberElement.textContent?.trim();
      const match = text?.match(/(\d+)/);
      if (match) {
        number = parseInt(match[1]);
        console.log('NetflixService: Found episode number in dedicated element:', number);
      }
    }

    // If no number found, try aria-label
    if (number === -1) {
      const ariaLabel = episode.getAttribute('aria-label');
      const match = ariaLabel?.match(/Episode (\d+)/i);
      if (match) {
        number = parseInt(match[1]);
        console.log('NetflixService: Found episode number in aria-label:', number);
      }
    }

    // Try to get duration
    const durationElement = episode.querySelector(this.SELECTORS.series.duration);
    if (durationElement) {
      const text = durationElement.textContent?.trim();
      if (text) {
        // Parse duration in format "XX min" or "X h XX min"
        const hours = text.match(/(\d+)\s*h/)?.[1];
        const minutes = text.match(/(\d+)\s*min/)?.[1];
        if (hours || minutes) {
          duration = (parseInt(hours || '0') * 60 + parseInt(minutes || '0')) * 60; // Convert to seconds
          console.log('NetflixService: Found duration:', duration, 'seconds');
        }
      }
    }

    // Try to get title from dedicated element
    const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
    if (titleElement) {
      title = titleElement.textContent?.trim();
      console.log('NetflixService: Found title:', title);
    }

    // Try to get episode URL
    const linkElement = episode.querySelector('a[href*="/watch/"]') as HTMLAnchorElement;
    if (linkElement?.href) {
      url = linkElement.href;
      console.log('NetflixService: Found episode URL:', url);
    } else {
      // If no direct link found, try to get the episode ID from data attributes
      const episodeId = episode.getAttribute('data-episode-id') || 
                       episode.querySelector('[data-episode-id]')?.getAttribute('data-episode-id');
      if (episodeId) {
        // Construct Netflix watch URL
        url = `https://www.netflix.com/watch/${episodeId}`;
        console.log('NetflixService: Constructed episode URL:', url);
      }
    }

    return { number, title, thumbnail, duration, url };
  }

  private async findEpisodes(): Promise<Element[]> {
    console.log('NetflixService: Finding episodes');
    
    // Try to find and click "Show More" button first
    const showMoreButton = document.querySelector(this.SELECTORS.series.showMoreButton) as HTMLButtonElement;
    if (showMoreButton) {
      console.log('NetflixService: Found Show More button, clicking it');
      showMoreButton.click();
      // Wait for new episodes to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Find all episode elements
    const containers = [
      // Primary episode containers
      '.episodeSelector-episodes-container',
      '.episode-container',
      // Fallback containers
      '[id*="episode-list"]',
      '[class*="episodeList"]'
    ];

    for (const container of containers) {
      const episodeContainer = document.querySelector(container);
      if (episodeContainer) {
        // Find all episode elements within the container
        const episodes = Array.from(episodeContainer.querySelectorAll('.titleCardList--container'));
        if (episodes.length > 0) {
          console.log('NetflixService: Found episodes:', episodes.length);
          return episodes;
        }
      }
    }

    // If no episodes found in containers, try direct episode selectors
    const directSelectors = [
      '.titleCardList--container',
      '[data-uia*="episode"]',
      '[class*="episode-item"]'
    ];

    for (const selector of directSelectors) {
      const episodes = Array.from(document.querySelectorAll(selector));
      if (episodes.length > 0) {
        console.log('NetflixService: Found episodes using direct selector:', episodes.length);
        return episodes;
      }
    }

    console.log('NetflixService: No episodes found');
    return [];
  }

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
        
        // Check for any series indicators
        const hasSeriesIndicator = document.querySelector(this.SELECTORS.series.seriesIndicators) !== null;
        
        // Check URL for series indicators
        const isSeriesUrl = window.location.pathname.includes('/tv/') || 
                          window.location.pathname.includes('/series/') ||
                          window.location.pathname.includes('/shows/');
        
        // Check genres for TV Show indicators
        const genres = Array.from(document.querySelectorAll('[data-uia="previewModal--tags-genre"] a'))
          .map(a => a.textContent?.toLowerCase() || '');
        const hasTvGenre = genres.some(g => g.includes('tv') || g.includes('series') || g.includes('shows'));
        
        const isSeries = hasSeriesIndicator || isSeriesUrl || hasTvGenre;
        console.log('NetflixService: Is series?', isSeries, {
          hasSeriesIndicator,
          isSeriesUrl,
          hasTvGenre,
          genres
        });
        return isSeries;
      },
      getSeriesData: async () => {
        console.log('NetflixService: Getting series data');
        
        // Try to expand episode list first
        await this.expandEpisodeList();
        
        // Wait a bit longer after expansion to ensure all episodes are loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get series metadata
        const seriesTitle = this.getSeriesTitle();
        const seriesThumbnail = document.querySelector(this.SELECTORS.series.thumbnail)?.getAttribute('src') || '';
        const seasonInfo = document.querySelector(this.SELECTORS.series.seasonInfo)?.textContent?.trim();
        const seasonNumber = seasonInfo ? parseInt(seasonInfo.match(/\d+/)?.[0] || '1') : 1;
        
        console.log('NetflixService: Series metadata:', { seriesTitle, seasonNumber });

        // Find valid episodes
        const episodes = await this.findEpisodes();
        console.log('NetflixService: Found', episodes.length, 'episodes');
        
        if (episodes.length === 0) {
          throw new Error('No episodes found');
        }

        const episodesData = episodes.map((episode, index) => {
          const { number, title, thumbnail, duration, url } = this.getEpisodeInfo(episode);
          const progressElement = episode.querySelector(this.SELECTORS.series.progress);

          const progress = progressElement ? parseFloat(progressElement.getAttribute('value') || '0') : 0;
          
          const episodeNumber = number === -1 ? index + 1 : number;
          
          console.log('NetflixService: Episode', episodeNumber, {
            title,
            duration,
            progress,
            thumbnail,
            url
          });
          
          return {
            id: Date.now().toString() + index,
            seriesId: window.location.pathname,
            seriesTitle,
            seasonNumber,
            episodeNumber,
            title: title || `Episode ${episodeNumber}`,
            type: 'episode' as const,
            url: url || window.location.href,
            service: 'netflix' as const,
            thumbnailUrl: thumbnail || '',
            seriesThumbnailUrl: seriesThumbnail,
            addedAt: Date.now(),
            order: index,
            duration: duration,
            progress: progress
          };
        });

        console.log('NetflixService: Series data:', { 
          seriesTitle, 
          seasonNumber, 
          episodeCount: episodesData.length 
        });
        
        return {
          type: 'series',
          id: window.location.pathname,
          title: seriesTitle,
          service: 'netflix' as const,
          thumbnailUrl: seriesThumbnail,
          seasonNumber,
          episodeCount: episodesData.length,
          episodes: episodesData,
          addedAt: Date.now()
        };
      }
    };
  }

  protected readonly config: ServiceConfig = {
    name: 'netflix',
    urlPattern: '*://*.netflix.com/*',
    titleSelector: '[data-uia="video-title"]',
    thumbnailSelector: '.previewModal--boxart img, .hero-image-wrapper img, .playerModel--player__storyArt',
    durationSelector: '[data-uia="controls-time-remaining"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      console.log('NetflixService: Checking if series');
      const isSeries = document.querySelector(this.SELECTORS.series.episodeItem) !== null;
      console.log('NetflixService: Is series?', isSeries);
      return isSeries;
    },
    episodeInfo: {
      containerSelector: this.SELECTORS.series.container,
      titleSelector: this.SELECTORS.series.episodeTitle,
      numberSelector: '[class*="episode-number"]',
      synopsisSelector: '[class*="synopsis"]',
      durationSelector: this.SELECTORS.series.duration,
      progressSelector: this.SELECTORS.series.progress
    },
    features: {
      expandList: {
        selector: '[data-uia="expand-episodes"], button[aria-label*="episodes"]',
        action: 'click',
        waitForSelector: this.SELECTORS.series.episodeItem
      }
    },
    getSeriesData: async () => {
      console.log('NetflixService: Getting series data');
      
      // Get series metadata
      const seriesTitle = this.getSeriesTitle();
      const seriesThumbnail = document.querySelector(this.SELECTORS.series.thumbnail)?.getAttribute('src') || '';
      const seasonInfo = document.querySelector(this.SELECTORS.series.seasonInfo)?.textContent?.trim();
      const seasonNumber = seasonInfo ? parseInt(seasonInfo.match(/\d+/)?.[0] || '1') : 1;

      const episodes = document.querySelectorAll(this.SELECTORS.series.episodeItem);
      console.log('NetflixService: Found episodes:', episodes.length);
      
      if (episodes.length === 0) {
        console.log('NetflixService: No episodes found');
        return null;
      }

      const episodesData = Array.from(episodes).map((episode, index) => {
        const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
        const thumbnailElement = episode.querySelector(this.SELECTORS.series.episodeThumbnail) as HTMLImageElement;
        console.log('NetflixService: Episode', index + 1, 'title:', titleElement?.getAttribute('alt'));
        
        return {
          id: Date.now().toString() + index,
          seriesId: window.location.pathname,
          seriesTitle,
          seasonNumber,
          episodeNumber: index + 1,
          title: titleElement?.getAttribute('alt')?.trim() || `Episode ${index + 1}`,
          type: 'episode' as const,
          url: window.location.href,
          service: 'netflix' as const,
          thumbnailUrl: thumbnailElement?.src || '',
          seriesThumbnailUrl: seriesThumbnail,
          addedAt: Date.now(),
          order: index
        };
      });

      console.log('NetflixService: Series data:', { 
        seriesTitle, 
        seasonNumber, 
        episodeCount: episodesData.length 
      });
      
      return {
        type: 'series',
        id: window.location.pathname,
        title: seriesTitle,
        service: 'netflix' as const,
        thumbnailUrl: seriesThumbnail,
        seasonNumber,
        episodeCount: episodesData.length,
        episodes: episodesData,
        addedAt: Date.now()
      };
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