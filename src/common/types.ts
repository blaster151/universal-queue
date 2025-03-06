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
  addedAt: number;
  order: number;
}

export type StreamingService = 'netflix' | 'youtube' | 'disneyplus' | 'primevideo' | 'other';

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
}

export interface QueueState {
  items: QueueItem[];
  lastUpdated: number;
} 