import { ServiceConfig, EpisodeItem } from '@/common/types';
import { BaseStreamingService } from './base';

export class MaxService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'max',
    urlPattern: '*://*.max.com/*',
    titleSelector: 'h1',
    thumbnailSelector: 'img[class*="StyledImage"]',
    durationSelector: '[class*="StyledMetadataContents"] span:nth-child(2)',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      console.log('MaxService: Checking if series page...');
      
      // Check for episode list or season selector
      const h1Element = document.querySelector('h1');
      const seasonSelector = document.querySelector('button[aria-expanded="false"]');
      const episodeList = document.querySelector('.gDmWGU');
      
      console.log('MaxService: Found elements:', {
        h1: h1Element?.textContent,
        seasonSelector: seasonSelector?.textContent,
        episodeList: !!episodeList
      });
      
      const isSeries = h1Element !== null && (seasonSelector !== null || episodeList !== null);
      console.log('MaxService: Is series page?', isSeries);
      return isSeries;
    },
    episodeInfo: {
      containerSelector: '.gDmWGU',  // StyledTileWrapper class
      titleSelector: '.ijqhqk',      // StyledPrimaryTitle class
      numberSelector: '.ijqhqk',     // Same as title, we'll parse number from it
      synopsisSelector: '.knpooy',   // StyledDescription class
      durationSelector: '.ixKBrK span:nth-child(2)',  // StyledMetadataContents class
      progressSelector: '[class*="progress-indicator"]'
    },
    features: {
      expandList: {
        selector: '[class*="show-more"], button[class*="expand"]',
        action: 'click',
        waitForSelector: '.gDmWGU'
      }
    },
    getSeriesData: async () => {
      console.log('MaxService: Getting series data...');
      
      // Get series title from h1
      const titleElement = document.querySelector('h1');
      const seriesTitle = titleElement?.textContent?.trim() || document.title.split('|')[0].trim();
      console.log('MaxService: Found series title:', seriesTitle);

      // Get series thumbnail
      const heroImage = document.querySelector('img[class*="StyledImage"]') as HTMLImageElement;
      const seriesThumbnail = heroImage?.src || '';
      console.log('MaxService: Found series thumbnail:', seriesThumbnail);

      // Get current season number from season selector
      const seasonText = document.querySelector('button[aria-expanded="false"]')?.textContent?.trim();
      const seasonNumber = seasonText ? parseInt(seasonText.match(/Season (\d+)/)?.[1] || '1') : 1;
      console.log('MaxService: Current season:', seasonNumber);

      // Find all episode elements
      console.log('MaxService: Looking for episode elements with selector .gDmWGU');
      const episodes = Array.from(document.querySelectorAll('.gDmWGU'));  // StyledTileWrapper class
      console.log('MaxService: Found episodes:', episodes.length);
      
      // Log the first episode's HTML for debugging
      if (episodes.length > 0) {
        console.log('MaxService: First episode HTML:', episodes[0].outerHTML);
      }

      if (episodes.length === 0) {
        console.log('MaxService: No episodes found, trying alternative selectors...');
        // Try alternative selectors
        const altSelectors = [
          '[class*="StyledTileWrapper"]',
          '[class*="episode-item"]',
          '[class*="episode-card"]'
        ];
        
        for (const selector of altSelectors) {
          const altEpisodes = document.querySelectorAll(selector);
          console.log(`MaxService: Trying selector ${selector}:`, altEpisodes.length);
          if (altEpisodes.length > 0) {
            console.log('MaxService: Found episodes with alternative selector');
            break;
          }
        }
        
        throw new Error('No episodes found with any selector');
      }

      // Extract episode data
      console.log('MaxService: Extracting episode data...');
      const episodesData = episodes.map((episode, index) => {
        console.log(`MaxService: Processing episode ${index + 1}`);
        const info = this.getEpisodeInfo(episode);
        console.log('MaxService: Episode info:', info);
        
        return {
          ...info,
          id: Date.now().toString() + index,
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

  protected isEpisodeWatched(progressElement: Element): boolean {
    const isWatched = progressElement.getAttribute('aria-valuenow') === '100' ||
                     progressElement.classList.contains('completed');
    console.log('MaxService: Episode watched status:', isWatched);
    return isWatched;
  }

  protected parseDuration(duration: string): number | undefined {
    console.log('MaxService: Parsing duration:', duration);
    // Max format: "31m"
    const minutes = parseInt(duration.replace('m', ''));
    const seconds = !isNaN(minutes) ? minutes * 60 : undefined;
    console.log('MaxService: Parsed duration:', seconds, 'seconds');
    return seconds;
  }

  protected getEpisodeInfo(episode: Element): Partial<EpisodeItem> {
    console.log('MaxService: Getting episode info for element:', episode.className);
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<EpisodeItem>;
    info.type = 'episode';
    
    // Get the episode-specific URL from the link
    const linkElement = episode.querySelector('a[href*="/video/watch/"]') as HTMLAnchorElement;
    if (linkElement?.href) {
      info.url = new URL(linkElement.href, window.location.origin).href;
      console.log('MaxService: Found episode URL:', info.url);
    } else {
      console.log('MaxService: No episode URL found in element:', episode.outerHTML);
    }

    // Extract episode number from title or aria-label
    const ariaLabel = episode.querySelector('a')?.getAttribute('aria-label');
    console.log('MaxService: Found aria-label:', ariaLabel);
    
    if (ariaLabel) {
      // Format: "Season 1, Episode 1. 1 of 10. Rated TV-MA. Runtime 31 minutes..."
      const match = ariaLabel.match(/Season (\d+), Episode (\d+)/);
      if (match) {
        info.seasonNumber = parseInt(match[1]);
        info.episodeNumber = parseInt(match[2]);
        console.log('MaxService: Extracted season/episode:', {
          season: info.seasonNumber,
          episode: info.episodeNumber
        });
      }
    }

    // Get thumbnail
    const thumbnailElement = episode.querySelector('img[srcset]') as HTMLImageElement;
    if (thumbnailElement?.src) {
      info.thumbnailUrl = thumbnailElement.src;
      console.log('MaxService: Found thumbnail:', info.thumbnailUrl);
    }

    console.log('MaxService: Final episode info:', info);
    return info;
  }
} 