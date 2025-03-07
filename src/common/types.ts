export type StreamingService = 'netflix' | 'youtube' | 'disneyplus' | 'primevideo' | 'max' | 'hulu' | 'appletv' | 'other';

export interface QueueItem {
  id: string;
  title: string;
  type: 'movie' | 'episode';
  url: string;
  service: StreamingService;
  thumbnailUrl?: string;
  duration?: number;
  episodeNumber?: number;
  seasonNumber?: number;
  synopsis?: string;
  isWatched?: boolean;
  addedAt: number;
  order: number;
}

export interface ServiceConfig {
  name: StreamingService;
  urlPattern: string;
  titleSelector: string;
  thumbnailSelector?: string;
  durationSelector?: string;
  completionDetector: {
    type: 'time' | 'event' | 'url';
    value: string;
  };
  isSeries?: () => boolean;
  getSeriesData?: () => Promise<QueueItem[]>;
  episodeInfo?: {
    containerSelector: string;
    titleSelector: string;
    numberSelector: string;
    synopsisSelector: string;
    durationSelector: string;
    progressSelector: string;
  };
  features?: {
    expandList?: {
      selector: string;
      action: 'click' | 'scroll' | 'hover';
      waitForSelector?: string;
    };
  };
}

export interface QueueState {
  items: QueueItem[];
  lastUpdated: number;
}

export interface StreamingServiceBase {
  // Core identification
  readonly name: string;
  readonly urlPattern: string;
  
  // Basic selectors every service should have
  readonly selectors: {
    title: string | string[];
    thumbnail?: string | string[];
    duration?: string | string[];
    video?: string | string[];
  };

  // Optional features that some services might have
  readonly features?: {
    expandList?: {
      selector: string;
      action: 'click' | 'scroll' | 'hover';
      waitForSelector?: string;
    };
    pagination?: {
      nextButton: string;
      container: string;
    };
    filters?: {
      unwatched: string;
      season: string;
    };
    progress?: {
      bar: string;
      isWatched: (element: Element) => boolean;
    };
  };

  // Series-specific functionality
  readonly series?: {
    container: string;
    episodeItem: string;
    seasonSelector?: string;
    episodeTitle: string;
    episodeThumbnail?: string;
    episodeNumber?: string;
    seasonNumber?: string;
    watchedIndicator?: string;
  };

  // Completion detection
  readonly completionDetector: {
    type: 'time' | 'event' | 'custom';
    value: string;
  };

  // Methods that can be overridden
  isVideoPage?(url: string): boolean;
  isSeriesPage?(document: Document, url: string): boolean;
  getVideoId?(url: string): string | null;
  extractMetadata?(element: Element): Partial<QueueItem>;
}

export interface StreamingServiceProvider {
  // Factory method to get service for current page
  getServiceForUrl(url: string): StreamingServiceBase | null;
  
  // Register a new service
  registerService(service: StreamingServiceBase): void;
  
  // Get all registered services
  getServices(): StreamingServiceBase[];
}

// Example Netflix implementation
export const NetflixService: StreamingServiceBase = {
  name: 'netflix',
  urlPattern: 'netflix.com/*',
  
  selectors: {
    title: ['.watch-title', '.title-title', '.title-card-title', '.title-info h1'],
    thumbnail: ['.watch-thumbnail', '.title-card-image', '.title-info img'],
    duration: '.watch-duration',
    video: 'video'
  },

  features: {
    expandList: {
      selector: '[data-uia="expand-episodes"]',
      action: 'click',
      waitForSelector: '.episode-item'
    },
    progress: {
      bar: '.progress-bar, .episode-progress',
      isWatched: (el) => el.getAttribute('style')?.includes('rgb(229, 9, 20)') ?? false
    }
  },

  series: {
    container: '.episode-list, .season-list',
    episodeItem: '.episode-item, .title-card',
    seasonSelector: '[data-uia="season-selector"]',
    episodeTitle: '.episode-title',
    episodeThumbnail: '.episode-thumbnail',
    episodeNumber: '[data-uia="episode-number"]',
    seasonNumber: '[data-uia="season-number"]',
    watchedIndicator: '.watched-indicator'
  },

  completionDetector: {
    type: 'time',
    value: 'video.currentTime >= video.duration - 0.5'
  },

  isVideoPage(url: string) {
    return url.includes('/watch/');
  },

  isSeriesPage(document: Document) {
    return !!document.querySelector(this.series?.container ?? '');
  },

  getVideoId(url: string) {
    return url.match(/watch\/(\d+)/)?.[1] ?? null;
  }
};

// Example YouTube implementation
export const YouTubeService: StreamingServiceBase = {
  name: 'youtube',
  urlPattern: 'youtube.com/*',
  
  selectors: {
    title: '#video-title',
    thumbnail: '#thumbnail img',
    duration: '.ytp-time-duration',
    video: '.html5-main-video'
  },

  features: {
    pagination: {
      nextButton: '.ytd-continuation-item-renderer',
      container: '#contents'
    }
  },

  series: {
    container: '#playlist-items',
    episodeItem: 'ytd-playlist-video-renderer',
    episodeTitle: '#video-title',
    episodeThumbnail: '#img',
    watchedIndicator: '#overlay-watched'
  },

  completionDetector: {
    type: 'event',
    value: 'video.ended'
  },

  isVideoPage(url: string) {
    return url.includes('watch?v=');
  },

  isSeriesPage(_document: Document, url: string) {
    return url.includes('playlist?list=');
  },

  getVideoId(url: string) {
    return url.match(/[?&]v=([^&]+)/)?.[1] ?? null;
  }
};

// Service provider implementation
export class StreamingServiceManager implements StreamingServiceProvider {
  private static instance: StreamingServiceManager;
  private services: Map<string, StreamingServiceBase> = new Map();

  private constructor() {
    // Register default services
    this.registerService(NetflixService);
    this.registerService(YouTubeService);
  }

  static getInstance(): StreamingServiceManager {
    if (!StreamingServiceManager.instance) {
      StreamingServiceManager.instance = new StreamingServiceManager();
    }
    return StreamingServiceManager.instance;
  }

  getServiceForUrl(url: string): StreamingServiceBase | null {
    for (const service of this.services.values()) {
      if (new RegExp(service.urlPattern).test(url)) {
        return service;
      }
    }
    return null;
  }

  registerService(service: StreamingServiceBase): void {
    this.services.set(service.name, service);
  }

  getServices(): StreamingServiceBase[] {
    return Array.from(this.services.values());
  }
} 