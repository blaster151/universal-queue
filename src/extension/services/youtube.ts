import { ServiceConfig } from '@/common/types';
import { BaseStreamingService } from './base';

export class YouTubeService extends BaseStreamingService {
  protected readonly config: ServiceConfig = {
    name: 'youtube',
    urlPattern: '*://*.youtube.com/*',
    titleSelector: '#video-title, .ytd-video-primary-info-renderer h1',
    thumbnailSelector: '#thumbnail img, .ytd-video-primary-info-renderer img',
    durationSelector: '.ytp-time-duration',
    completionDetector: {
      type: 'event',
      value: 'video.ended'
    },
    isSeries: () => {
      // Check if we're on a playlist page
      return window.location.href.includes('playlist?list=') ||
             document.querySelector('#playlist-items') !== null;
    },
    episodeInfo: {
      containerSelector: 'ytd-playlist-video-renderer',
      titleSelector: '#video-title',
      numberSelector: '.index-message',
      synopsisSelector: '#description-text',
      durationSelector: '.ytd-thumbnail-overlay-time-status-renderer',
      progressSelector: '#progress'
    }
  };

  protected isEpisodeWatched(progressElement: Element): boolean {
    // YouTube shows a red progress bar for watched videos
    const style = progressElement.getAttribute('style');
    return style?.includes('width: 100%') || false;
  }

  protected parseDuration(duration: string): number | undefined {
    // YouTube duration format: "MM:SS" or "H:MM:SS"
    const parts = duration.trim().split(':').map(Number);
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return undefined;
  }
} 