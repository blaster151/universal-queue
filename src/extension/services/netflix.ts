import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class NetflixService extends BaseStreamingService {
  private readonly SELECTORS = {
    series: {
      container: '[data-uia="episode-item"]',
      episodeItem: '[data-uia="episode-item"]',
      expandButton: '[data-uia="expand-episodes"], button[aria-label*="episodes"]',
      seriesIndicators: '[class*="episode-list"], [class*="season-list"]',
      title: '[data-uia="video-title"]',
      thumbnail: '.previewModal--boxart img, .hero-image-wrapper img',
      seasonInfo: '[class*="season-info"]',
      episodeTitle: '[data-uia="episode-title"]',
      episodeDescription: '[class*="synopsis"]',
      episodeDuration: '[data-uia="duration"]',
      episodeProgress: '[class*="progress"]',
      showMoreButton: '[data-uia="expand-episodes"]'
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

    // Try to get episode number first
    const numberElement = episode.querySelector(this.SELECTORS.series.episodeItem);
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

    // Try to get duration first (before title)
    const durationElement = episode.querySelector(this.SELECTORS.series.episodeDuration);
    console.log('NetflixService: Duration element found:', durationElement?.outerHTML);
    if (durationElement) {
      const text = durationElement.textContent?.trim();
      console.log('NetflixService: Raw duration text:', text);
      if (text) {
        // Netflix uses minute integers with 'm' suffix
        const minutes = parseInt(text.replace('m', ''));
        if (!isNaN(minutes)) {
          duration = minutes * 60; // Convert to seconds
          console.log('NetflixService: Calculated duration:', duration, 'seconds');
        }
      }
    } else {
      console.log('NetflixService: No duration element found with selectors:', this.SELECTORS.series.episodeDuration);
      // Log all potential duration-like elements for debugging
      episode.querySelectorAll('[class*="duration"], [class*="runtime"], [class*="time"]').forEach(el => {
        console.log('NetflixService: Potential duration element:', el.outerHTML);
      });
    }

    // Try to get title from dedicated element
    const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
    if (titleElement) {
      const rawTitle = titleElement.textContent?.trim();
      // If the title is just a number, format it as "Episode X"
      if (rawTitle && /^\d+$/.test(rawTitle)) {
        title = `Episode ${rawTitle}`;
      } else {
        title = rawTitle;
      }
      console.log('NetflixService: Found title:', title);
    }

    // If no title found but we have a number, use "Episode X"
    if (!title && number !== -1) {
      title = `Episode ${number}`;
      console.log('NetflixService: Using generated title:', title);
    }

    // Try to get thumbnail
    const thumbnailElement = episode.querySelector(this.SELECTORS.series.thumbnail) as HTMLImageElement;
    if (thumbnailElement?.src) {
      thumbnail = thumbnailElement.src;
      console.log('NetflixService: Found thumbnail:', thumbnail);
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
      titleSelector: this.SELECTORS.series.title,
      thumbnailSelector: this.SELECTORS.series.thumbnail,
      durationSelector: this.SELECTORS.series.episodeDuration,
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
      episodeInfo: {
        containerSelector: this.SELECTORS.series.container,
        titleSelector: this.SELECTORS.series.episodeTitle,
        numberSelector: '[class*="episode-number"]',
        synopsisSelector: this.SELECTORS.series.episodeDescription,
        durationSelector: this.SELECTORS.series.episodeDuration,
        progressSelector: this.SELECTORS.series.episodeProgress
      },
      features: {
        expandList: {
          selector: this.SELECTORS.series.expandButton,
          action: 'click',
          waitForSelector: this.SELECTORS.series.episodeItem
        }
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
          const progressElement = episode.querySelector(this.SELECTORS.series.episodeProgress);

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
    titleSelector: this.SELECTORS.series.title,
    thumbnailSelector: this.SELECTORS.series.thumbnail,
    durationSelector: this.SELECTORS.series.episodeDuration,
    completionDetector: {
      type: 'event',
      value: 'video.ended'
    },
    isSeries: () => {
      const url = window.location.href;
      return url.includes('/browse') || url.includes('/title/');
    },
    episodeInfo: {
      containerSelector: this.SELECTORS.series.container,
      titleSelector: this.SELECTORS.series.episodeTitle,
      numberSelector: '[class*="episode-number"]',
      synopsisSelector: this.SELECTORS.series.episodeDescription,
      durationSelector: this.SELECTORS.series.episodeDuration,
      progressSelector: this.SELECTORS.series.episodeProgress
    },
    features: {
      expandList: {
        selector: this.SELECTORS.series.expandButton,
        action: 'click',
        waitForSelector: this.SELECTORS.series.episodeItem
      }
    },
    getSeriesData: async () => {
      console.log('NetflixService: Getting series data');
      
      // Try to expand episode list first
      await this.expandEpisodeList();
      
      // Wait a bit longer after expansion to ensure all episodes are loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get series metadata
      const titleElement = document.querySelector(this.SELECTORS.series.title);
      const seriesTitle = titleElement?.textContent?.trim() || document.title.split('|')[0].trim();
      
      const heroImage = document.querySelector(this.SELECTORS.series.thumbnail) as HTMLImageElement;
      const seriesThumbnail = heroImage?.src || '';
      
      const seasonInfo = document.querySelector(this.SELECTORS.series.seasonInfo)?.textContent || '';
      const seasonNumber = seasonInfo ? parseInt(seasonInfo.match(/\d+/)?.[0] || '1') : 1;
      
      console.log('NetflixService: Series metadata:', { seriesTitle, seasonNumber });

      // Find valid episodes
      const episodes = Array.from(document.querySelectorAll(this.SELECTORS.series.episodeItem));
      console.log('NetflixService: Found', episodes.length, 'episodes');
      
      if (episodes.length === 0) {
        console.log('NetflixService: No episodes found');
        return {
          type: 'series',
          id: window.location.pathname,
          title: seriesTitle,
          service: 'netflix',
          thumbnailUrl: seriesThumbnail,
          seasonNumber: 1,
          episodeCount: 0,
          episodes: [],
          addedAt: Date.now()
        };
      }

      const episodesData = episodes.map((episode, index) => {
        const { number, title, thumbnail, duration, url } = this.getEpisodeInfo(episode);
        const progressElement = episode.querySelector(this.SELECTORS.series.episodeProgress);

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
          id: url?.split('/').pop() || Date.now().toString() + index,
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

      return {
        type: 'series',
        id: window.location.pathname,
        title: seriesTitle,
        service: 'netflix',
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
    // Netflix uses minute integers with 'm' suffix
    const minutes = parseInt(duration.replace('m', ''));
    return !isNaN(minutes) ? minutes * 60 : undefined;
  }
} 