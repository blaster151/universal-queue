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
        // Various expand buttons Netflix uses
        '[data-uia="expand-episodes"]',
        'button[aria-label*="episodes"]',
        'button[aria-label*="Episodes"]',
        '[role="button"][aria-label*="episodes"]',
        '[role="button"][aria-label*="Episodes"]',
        // Additional episode list buttons
        'button[aria-label*="See more"]',
        'button[aria-label*="Show all"]',
        '[role="button"][aria-label*="See more"]',
        '[role="button"][aria-label*="Show all"]'
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
    
    // Try to scroll to trigger lazy loading
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const expandButton = document.querySelector(this.SELECTORS.series.expandButton);
    if (expandButton instanceof HTMLElement) {
      console.log('NetflixService: Found expand button, clicking');
      expandButton.click();
      
      // Wait for episodes to load with increasing timeouts
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        const episodes = document.querySelectorAll(this.SELECTORS.series.episodeItem);
        if (episodes.length > 0) {
          console.log('NetflixService: Episodes loaded after clicking expand');
          return;
        }
      }
      console.log('NetflixService: No episodes found after expanding');
    } else {
      console.log('NetflixService: No expand button found, trying to find episodes directly');
      // Sometimes episodes are already visible without needing to expand
      const episodes = document.querySelectorAll(this.SELECTORS.series.episodeItem);
      if (episodes.length > 0) {
        console.log('NetflixService: Found episodes without expanding');
        return;
      }
    }
  }

  private isValidEpisodeElement(element: Element): boolean {
    // Check if the element has enough episode-specific content
    const hasTitle = element.querySelector(this.SELECTORS.series.episodeTitle)?.textContent?.trim();
    const hasImage = element.querySelector('img');
    const hasEpisodeNumber = element.querySelector(this.SELECTORS.series.episodeNumber) || 
                           element.getAttribute('aria-label')?.match(/Episode \d+/i) ||
                           element.querySelector('button[aria-label*="Episode"], a[aria-label*="Episode"]');
    const hasPlayButton = element.querySelector('button[aria-label*="Play"]');
    
    // Log what we found for debugging
    console.log('NetflixService: Validating episode element:', {
      element: element.className,
      hasTitle,
      hasImage: !!hasImage,
      hasEpisodeNumber: !!hasEpisodeNumber,
      hasPlayButton: !!hasPlayButton,
      ariaLabel: element.getAttribute('aria-label')
    });

    // Element must have at least 2 of these characteristics to be considered valid
    const validityScore = [hasTitle, hasImage, hasEpisodeNumber, hasPlayButton].filter(Boolean).length;
    return validityScore >= 2;
  }

  private getEpisodeInfo(episode: Element): { number: number; title: string | undefined; thumbnail: string | undefined } {
    console.log('NetflixService: Getting episode info for element:', episode.className);
    
    let number = -1;
    let title: string | undefined;
    let thumbnail: string | undefined;

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

    // Try to get title from dedicated element
    const titleElement = episode.querySelector(this.SELECTORS.series.episodeTitle);
    if (titleElement) {
      title = titleElement.textContent?.trim();
      if (title) {
        // Remove episode number prefix if present
        title = title.replace(/^Episode \d+:?\s*/i, '').trim();
        // Remove duration suffix if present
        title = title.replace(/\s*\(\d+m\)\s*$/, '').trim();
        console.log('NetflixService: Found and cleaned title:', title);
      }
    }

    // If no title found or title is just a year, try to get a better title from aria-label
    if (!title || /^\d{4}$/.test(title)) {
      const ariaLabel = episode.getAttribute('aria-label');
      if (ariaLabel) {
        // Try to extract everything after the episode number and before any duration
        const match = ariaLabel.match(/Episode \d+[:.]\s*([^(]+)/i);
        if (match?.[1]) {
          const cleanTitle = match[1].trim();
          // Only use if it's not just a year
          if (!/^\d{4}$/.test(cleanTitle)) {
            title = this.createShortTitle(cleanTitle);
            console.log('NetflixService: Extracted title from aria-label:', title);
          }
        }
      }
    }

    // If still no good title, try to create a title from the description
    if (!title || /^\d{4}$/.test(title)) {
      const descElement = episode.querySelector(this.SELECTORS.series.episodeDescription);
      if (descElement) {
        const desc = descElement.textContent?.trim();
        if (desc) {
          title = this.createShortTitle(desc);
          console.log('NetflixService: Created title from description:', title);
        }
      }
    }

    // If still no title or title is just a year, use episode number
    if (!title || /^\d{4}$/.test(title)) {
      title = `Episode ${number === -1 ? 'Unknown' : number}`;
      console.log('NetflixService: Using fallback title:', title);
    }

    return { number, title, thumbnail };
  }

  private createShortTitle(text: string): string {
    // Split into parts by various delimiters
    const parts = text.split(/[,.:;]/).map(part => part.trim());
    
    // Process each part to find the best title
    for (const part of parts) {
      // Skip if it's just a year
      if (/^\d{4}$/.test(part)) continue;
      
      // Skip if it starts with a year
      if (/^\d{4}[,.: ]/.test(part)) continue;
      
      // Skip if it's too short
      if (part.length < 3) continue;
      
      // Found a good part, make it concise if needed
      if (part.length > 40) {
        // Try to find a natural break point
        const breakPoint = part.lastIndexOf(' ', 37);
        return breakPoint > 0 ? part.substring(0, breakPoint) + '...' : part.substring(0, 37) + '...';
      }
      
      return part;
    }
    
    // If we couldn't find a good part, use the first non-empty part
    const firstNonEmpty = parts.find(part => part.length > 0);
    if (firstNonEmpty) {
      return firstNonEmpty.length > 40 ? firstNonEmpty.substring(0, 37) + '...' : firstNonEmpty;
    }
    
    // Last resort: return the original text, truncated if needed
    return text.length > 40 ? text.substring(0, 37) + '...' : text;
  }

  private async findEpisodes(): Promise<Element[]> {
    console.log('NetflixService: Looking for episodes');
    
    // Try different episode list containers
    const containers = [
      '[data-uia="episode-list"]',
      '.episode-list',
      '.episodeSelector',
      '.titleCardList--container'
    ];

    for (const container of containers) {
      const listElement = document.querySelector(container);
      if (listElement) {
        console.log('NetflixService: Found episode container:', container);
        const episodes = Array.from(listElement.querySelectorAll(this.SELECTORS.series.episodeItem))
          .filter(episode => this.isValidEpisodeElement(episode));
        
        if (episodes.length > 0) {
          console.log('NetflixService: Found valid episodes in container:', container);
          return episodes;
        }
      }
    }

    // If no container found, try finding episodes directly
    const allEpisodes = Array.from(document.querySelectorAll(this.SELECTORS.series.episodeItem))
      .filter(episode => this.isValidEpisodeElement(episode));
    
    console.log('NetflixService: Found episodes directly:', allEpisodes.length);
    return allEpisodes;
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
        
        // Get series metadata
        const seriesTitle = this.getSeriesTitle();
        const seriesThumbnail = document.querySelector(this.SELECTORS.series.thumbnail)?.getAttribute('src') || '';
        const seasonInfo = document.querySelector(this.SELECTORS.series.seasonInfo)?.textContent?.trim();
        const seasonNumber = seasonInfo ? parseInt(seasonInfo.match(/\d+/)?.[0] || '1') : 1;
        
        console.log('NetflixService: Series metadata:', { seriesTitle, seasonNumber });

        // Find valid episodes
        const episodes = await this.findEpisodes();
        console.log('NetflixService: Found valid episodes:', episodes.length);
        
        if (episodes.length === 0) {
          console.log('NetflixService: No valid episodes found');
          return null;
        }

        const episodesData = episodes.map((episode, index) => {
          const { number, title, thumbnail } = this.getEpisodeInfo(episode);
          const durationElement = episode.querySelector(this.SELECTORS.series.duration);
          const progressElement = episode.querySelector(this.SELECTORS.series.progress);

          const duration = durationElement?.textContent?.trim() || '';
          const durationInMinutes = duration ? parseInt(duration.replace('m', '')) : undefined;
          const progress = progressElement ? parseFloat(progressElement.getAttribute('value') || '0') : 0;
          
          const episodeNumber = number === -1 ? index + 1 : number;
          
          console.log('NetflixService: Episode', episodeNumber, {
            title,
            duration,
            progress,
            thumbnail
          });
          
          return {
            id: Date.now().toString() + index,
            seriesId: window.location.pathname,
            seriesTitle,
            seasonNumber,
            episodeNumber,
            title: title || `Episode ${episodeNumber}`,
            type: 'episode' as const,
            url: window.location.href,
            service: 'netflix' as const,
            thumbnailUrl: thumbnail || '',
            seriesThumbnailUrl: seriesThumbnail,
            addedAt: Date.now(),
            order: index,
            duration: durationInMinutes,
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