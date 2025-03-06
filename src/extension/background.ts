import { ServiceConfig } from '@/common/types';
import { StorageService } from '@/common/storage';

const serviceConfigs: Record<string, ServiceConfig> = {
  'netflix.com': {
    name: 'netflix',
    urlPattern: 'netflix.com/watch/*',
    titleSelector: '.watch-title',
    thumbnailSelector: '.watch-thumbnail',
    durationSelector: '.watch-duration',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    }
  },
  'youtube.com': {
    name: 'youtube',
    urlPattern: 'youtube.com/watch*',
    titleSelector: 'h1.title',
    thumbnailSelector: 'link[rel="image_src"]',
    durationSelector: '.ytp-time-duration',
    completionDetector: {
      type: 'event',
      value: 'video.ended'
    }
  },
  'disneyplus.com': {
    name: 'disneyplus',
    urlPattern: 'disneyplus.com/video/*',
    titleSelector: '.video-title',
    thumbnailSelector: '.video-thumbnail',
    durationSelector: '.video-duration',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    }
  },
  'primevideo.com': {
    name: 'primevideo',
    urlPattern: 'primevideo.com/detail/*',
    titleSelector: '.video-title',
    thumbnailSelector: '.video-thumbnail',
    durationSelector: '.video-duration',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    }
  }
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'VIDEO_COMPLETED') {
    handleVideoCompletion(sender.tab?.id, sender.tab?.url);
  }
  return true;
});

async function handleVideoCompletion(tabId?: number, tabUrl?: string) {
  if (!tabId || !tabUrl) return;

  const storage = StorageService.getInstance();
  const state = await storage.getQueueState();
  
  // Find the current item in the queue
  const currentItem = state.items.find(item => {
    const url = new URL(item.url);
    return url.hostname === new URL(tabUrl).hostname;
  });

  if (!currentItem) return;

  // Find the next item in the queue
  const currentIndex = state.items.findIndex(item => item.id === currentItem.id);
  const nextItem = state.items[currentIndex + 1];

  if (nextItem) {
    // Open the next item in a new tab
    chrome.tabs.create({ url: nextItem.url });
  }
}

// Listen for tab updates to detect when a video starts playing
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    const service = Object.entries(serviceConfigs).find(([domain]) => 
      url.hostname.includes(domain)
    );

    if (service) {
      // Inject the completion detection script
      chrome.scripting.executeScript({
        target: { tabId },
        func: injectCompletionDetector,
        args: [service[1]]
      });
    }
  }
});

function injectCompletionDetector(config: ServiceConfig) {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const video = document.querySelector('video');
      if (!video) return;

      const checkCompletion = () => {
        if (${config.completionDetector.value}) {
          chrome.runtime.sendMessage({ type: 'VIDEO_COMPLETED' });
        }
      };

      if (config.completionDetector.type === 'time') {
        video.addEventListener('timeupdate', checkCompletion);
      } else if (config.completionDetector.type === 'event') {
        video.addEventListener('ended', () => {
          chrome.runtime.sendMessage({ type: 'VIDEO_COMPLETED' });
        });
      }
    })();
  `;
  document.head.appendChild(script);
} 