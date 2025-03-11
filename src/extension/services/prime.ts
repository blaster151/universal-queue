import { QueueItem, StreamingService, ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class PrimeVideoService extends BaseStreamingService {
  readonly selectors = {
    episodeItem: '[data-testid="episode-list-item"]',
    episodeContainer: 'div#tab-content-episodes',
    buttonContainer: '.uq-button-container',
    episodeTitle: '[data-testid="seh-tile-content-title"], .P1uAb6',  // The actual episode title
    episodeNumber: '[data-testid="episode-number"], ._36qUej', // Contains "S1 E1 - Title"
    episodeDescription: '[data-testid="episode-synopsis"], ._3qsVvm',
    thumbnail: '[data-testid="episode-thumbnail"], img.FHb5CR',
    watchButton: '[data-testid="episodes-playbutton"]',
    duration: '[data-testid="episode-runtime"]',
    progressBar: '[data-testid="episode-progress"], [role="progressbar"], ._1RqH1v'
  };

  protected readonly config: ServiceConfig = {
    name: 'primevideo' as StreamingService,
    urlPattern: '*://*.amazon.com/*/video/*, *://*.amazon.com/gp/video/detail/*',
    titleSelector: '.P1uAb6',
    thumbnailSelector: 'img.FHb5CR',
    durationSelector: '[data-testid="episode-runtime"]',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: async () => {
      // First check if we're on a video detail page
      if (!window.location.pathname.includes('/video/detail/')) {
        console.log('Prime: Not a video detail page');
        return false;
      }

      // Check for episode items
      const episodeCount = document.querySelectorAll(this.selectors.episodeItem).length;
      console.log('Prime: Found episode items:', episodeCount);

      // Check for the episodes container
      const hasEpisodesContainer = document.querySelector(this.selectors.episodeContainer);
      console.log('Prime: Has episodes container:', !!hasEpisodesContainer);

      return !!hasEpisodesContainer && episodeCount > 0;
    },
    getSeriesData: async () => {
      const episodes = await this.getSeriesData();
      const seriesId = window.location.pathname.split('/detail/')[1]?.split('?')[0] || 'unknown';
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
        service: 'primevideo' as StreamingService,
        episodes: episodeItems,
        seasonNumber: 1,
        episodeCount,
        addedAt: Date.now(),
        url: window.location.href,
        thumbnailUrl: seriesThumbnailUrl
      };
    },
    episodeInfo: {
      containerSelector: this.selectors.episodeContainer,
      titleSelector: this.selectors.episodeTitle,
      numberSelector: this.selectors.episodeNumber,
      synopsisSelector: this.selectors.episodeDescription,
      durationSelector: this.selectors.duration,
      progressSelector: this.selectors.progressBar
    }
  };

  isSeries(): boolean {
    // First check if we're on a video detail page
    if (!window.location.pathname.includes('/video/detail/')) {
      console.log('Prime: Not a video detail page');
      return false;
    }

    // Check for episode items
    const episodeCount = document.querySelectorAll(this.selectors.episodeItem).length;
    console.log('Prime: Found episode items:', episodeCount);

    // Check for the episodes container
    const hasEpisodesContainer = document.querySelector(this.selectors.episodeContainer);
    console.log('Prime: Has episodes container:', !!hasEpisodesContainer);

    return !!hasEpisodesContainer && episodeCount > 0;
  }

  async getSeriesData(): Promise<QueueItem[]> {
    console.log('Prime: Starting getSeriesData');
    const episodes = Array.from(document.querySelectorAll<HTMLElement>(this.selectors.episodeItem));
    console.log('Prime: Found episodes:', {
      count: episodes.length,
      selector: this.selectors.episodeItem,
      firstEpisode: episodes[0]?.outerHTML
    });

    const seriesId = window.location.pathname.split('/detail/')[1]?.split('?')[0] || '';
    console.log('Prime: Series ID:', seriesId);
    const items: QueueItem[] = [];
    
    for (const episode of episodes) {
      const titleElement = episode.querySelector(this.selectors.episodeTitle);
      const numberElement = episode.querySelector(this.selectors.episodeNumber);
      const thumbnailElement = episode.querySelector(this.selectors.thumbnail) as HTMLImageElement;
      const watchButton = episode.querySelector(this.selectors.watchButton) as HTMLAnchorElement;
      const durationElement = episode.querySelector(this.selectors.duration);

      if (!titleElement || !numberElement || !watchButton) {
        console.warn('Prime: Missing required elements for episode');
        continue;
      }

      const title = titleElement.textContent?.trim() || '';
      const numberText = numberElement.textContent?.trim() || '';
      const thumbnailUrl = thumbnailElement?.src || '';
      const href = watchButton.getAttribute('href') || '';
      const duration = durationElement?.textContent?.trim() || '';
      
      // Extract season and episode numbers from text like "S1 E1 - Title"
      const episodeMatch = numberText.match(/S(\d+)\s*E(\d+)/i);
      const seasonNumber = episodeMatch ? parseInt(episodeMatch[1]) : 1;
      const episodeNumber = episodeMatch ? parseInt(episodeMatch[2]) : null;
      
      console.log('Prime: Processing episode:', {
        title,
        numberText,
        seasonNumber,
        episodeNumber,
        duration,
        thumbnailUrl,
        href
      });

      if (!episodeNumber) {
        console.warn('Prime: Could not parse episode number from:', numberText);
        continue;
      }

      const seriesId = window.location.pathname.split('/detail/')[1]?.split('?')[0] || 'unknown';
      const seriesTitle = document.title.split(' - ')[0] || 'Unknown Series';
      const seriesThumbnailUrl = document.querySelector(this.selectors.thumbnail)?.getAttribute('src') || '';

      items.push({
        id: href.split('/ref=')[0].split('/').pop() || '',
        title: title.trim(),
        episodeNumber,
        seasonNumber,
        url: new URL(href, window.location.origin).href,
        type: 'episode' as const,
        service: 'primevideo' as StreamingService,
        seriesId,
        seriesTitle,
        seriesThumbnailUrl,
        thumbnailUrl,
        order: items.length,
        addedAt: Date.now()
      });
    }
    
    console.log('Prime: Finished processing episodes:', {
      totalFound: items.length,
      items
    });
    
    return items;
  }

  public getConfig() {
    return this.config;
  }

  protected getEpisodeInfo(episode: Element): Partial<QueueItem> {
    console.log('Prime: Getting episode info for element:', {
      elementId: episode.id,
      className: episode.className
    });
    
    const info = super.extractEpisodeInfo(episode, this.config) as Partial<QueueItem>;
    info.type = 'episode';
    
    // Get the episode-specific URL from the watch button
    const watchButton = episode.querySelector(this.selectors.watchButton) as HTMLAnchorElement;
    if (watchButton?.href) {
      info.url = new URL(watchButton.href, window.location.origin).href;
      console.log('Prime: Found episode URL:', info.url);
    }

    // Get episode number
    const numberElement = episode.querySelector(this.selectors.episodeNumber);
    if (numberElement) {
      const numberText = numberElement.textContent?.trim() || '';
      const episodeMatch = numberText.match(/S(\d+)\s*E(\d+)/i);
      if (episodeMatch) {
        info.seasonNumber = parseInt(episodeMatch[1]);
        info.episodeNumber = parseInt(episodeMatch[2]);
        console.log('Prime: Extracted episode numbers:', {
          season: info.seasonNumber,
          episode: info.episodeNumber
        });
      }
    }

    // Get thumbnail
    const thumbnailElement = episode.querySelector(this.selectors.thumbnail) as HTMLImageElement;
    if (thumbnailElement?.src) {
      info.thumbnailUrl = thumbnailElement.src;
      console.log('Prime: Found thumbnail:', info.thumbnailUrl);
    }

    console.log('Prime: Final episode info:', info);
    return info;
  }

  protected parseDuration(duration: string): number | undefined {
    console.log('Prime: Parsing duration:', duration);
    // Prime format can be "1 h 1 min" or "58m"
    const hours = duration.match(/(\d+)\s*h/)?.[1];
    const minutes = duration.match(/(\d+)\s*m(?:in)?/)?.[1];
    
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

    return false;
  }
} 