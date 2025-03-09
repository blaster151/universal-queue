import { ServiceConfig, EpisodeItem } from '@/common/types';
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

  private async waitForContent(maxAttempts = 10, delayMs = 1000): Promise<boolean> {
    console.log('MaxService: Waiting for content to load...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`MaxService: Attempt ${attempt}/${maxAttempts}`);
      
      // Check for any content in the main area
      const bodyText = document.body.textContent || '';
      const hasContent = bodyText.trim().length > 0;
      const hasH1 = document.querySelector('h1') !== null;
      const hasButtons = document.querySelectorAll('button').length > 0;
      
      // Log all potential episode elements
      const episodeElements = document.querySelectorAll(this.SELECTORS.series.episodeItem);
      console.log('MaxService: Found potential episode elements:', Array.from(episodeElements).map(el => ({
        className: el.className,
        id: el.id,
        ariaLabel: el.getAttribute('aria-label'),
        text: el.textContent?.trim()
      })));
      
      const episodeCount = episodeElements.length;
      
      console.log('MaxService: Content check:', {
        hasContent,
        hasH1,
        buttonCount: document.querySelectorAll('button').length,
        episodeCount,
        h1Text: document.querySelector('h1')?.textContent
      });
      
      if (hasContent && (hasH1 || hasButtons) && episodeCount > 0) {
        console.log('MaxService: Content and episodes found!');
        return true;
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.log('MaxService: Timed out waiting for content');
    return false;
  }

  protected readonly config: ServiceConfig = {
    name: 'max',
    urlPattern: '*://*.max.com/*',
    titleSelector: this.SELECTORS.series.title,
    thumbnailSelector: this.SELECTORS.series.heroImage,
    durationSelector: this.SELECTORS.series.episodeMetadata + ' span:nth-child(2)',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      console.log('MaxService: Checking if series page...');
      
      // First check URL pattern
      const isShowUrl = window.location.pathname.includes('/show/');
      console.log('MaxService: URL check:', { isShowUrl, path: window.location.pathname });
      
      if (!isShowUrl) {
        console.log('MaxService: Not a show URL');
        return false;
      }

      // Wait for content to load
      const contentLoaded = await this.waitForContent();
      if (!contentLoaded) {
        console.log('MaxService: Content never loaded');
        return false;
      }

      // Check for required elements
      const titleElement = document.querySelector(this.SELECTORS.series.title);
      const seasonSelector = document.querySelector(this.SELECTORS.series.seasonSelector);
      const episodeList = document.querySelector(this.SELECTORS.series.episodeList);
      const episodeLinks = document.querySelectorAll(this.SELECTORS.series.episodeItem);
      
      console.log('MaxService: Found elements:', {
        title: titleElement?.textContent,
        seasonSelector: seasonSelector?.textContent,
        episodeList: !!episodeList,
        episodeCount: episodeLinks.length
      });
      
      // Consider it a series page if we have a season selector or episode list
      const isSeries = seasonSelector !== null || episodeList !== null || episodeLinks.length > 0;
      console.log('MaxService: Is series page?', isSeries);
      return isSeries;
    },
    episodeInfo: {
      containerSelector: this.SELECTORS.series.episodeItem,
      titleSelector: this.SELECTORS.series.episodeTitle,
      numberSelector: '[class*="StyledEpisodeNumber"], [class*="episode-number"]',
      synopsisSelector: this.SELECTORS.series.episodeDescription,
      durationSelector: this.SELECTORS.series.episodeMetadata + ' span:nth-child(2)',
      progressSelector: this.SELECTORS.series.progressBar
    },
    features: {
      expandList: {
        selector: '[class*="show-more"], button[class*="expand"]',
        action: 'click',
        waitForSelector: this.SELECTORS.series.episodeItem
      }
    },
    getSeriesData: async () => {
      console.log('MaxService: Getting series data...');
      
      // Wait for content to load
      const contentLoaded = await this.waitForContent();
      if (!contentLoaded) {
        throw new Error('Content failed to load');
      }

      // Get series title - try multiple approaches
      const titleElement = document.querySelector(this.SELECTORS.series.title);
      let seriesTitle = titleElement?.textContent?.trim();
      
      if (!seriesTitle) {
        // Try getting from document title
        seriesTitle = document.title.split('|')[0].trim();
        console.log('MaxService: Using document title:', seriesTitle);
      }

      if (!seriesTitle) {
        throw new Error('Could not find series title');
      }
      console.log('MaxService: Found series title:', seriesTitle);

      // Get series thumbnail from hero image
      const heroImage = document.querySelector(this.SELECTORS.series.heroImage) as HTMLImageElement;
      const seriesThumbnail = heroImage?.src || '';
      console.log('MaxService: Found series thumbnail:', seriesThumbnail);

      // Get current season number from season selector
      const seasonSelector = document.querySelector(this.SELECTORS.series.seasonSelector);
      const seasonText = seasonSelector?.textContent?.trim() || '';
      const seasonNumber = seasonText ? parseInt(seasonText.match(/Season (\d+)/)?.[1] || '1') : 1;
      console.log('MaxService: Current season:', seasonNumber);

      // Find all episode elements
      console.log('MaxService: Looking for episode elements');
      const episodes = Array.from(document.querySelectorAll(this.SELECTORS.series.episodeItem));
      console.log('MaxService: Found episodes:', episodes.length);

      if (episodes.length === 0) {
        console.log('MaxService: No episodes found');
        throw new Error('No episodes found');
      }

      // Extract episode data
      console.log('MaxService: Extracting episode data...');
      const episodesData = episodes.map((episode, index) => {
        console.log(`MaxService: Processing episode ${index + 1}`);
        const info = this.getEpisodeInfo(episode);
        console.log('MaxService: Episode info:', info);
        
        return {
          ...info,
          id: episode.getAttribute('href')?.split('/').pop() || Date.now().toString() + index,
          seriesId: window.location.pathname,
          seriesTitle,
          seasonNumber,
          type: 'episode' as const,
          service: 'max' as const,
          seriesThumbnailUrl: seriesThumbnail,
          addedAt: Date.now(),
          order: index
        } as EpisodeItem;
      });

      console.log('MaxService: Finished processing all episodes:', {
        totalEpisodes: episodesData.length,
        seriesTitle,
        seasonNumber
      });

      return {
        type: 'series',
        id: window.location.pathname,
        title: seriesTitle,
        service: 'max',
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

  protected getEpisodeInfo(episode: Element): Partial<EpisodeItem> {
    console.log('MaxService: Getting episode info for element:', {
      elementId: episode.id,
      className: episode.className,
      href: episode.getAttribute('href'),
      ariaLabel: episode.getAttribute('aria-label'),
      text: episode.textContent?.trim()
    });
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<EpisodeItem>;
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