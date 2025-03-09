import { ServiceConfig } from '../common/types';
import { StorageService } from '../common/storage';

// Keep the service worker alive with periodic alarms
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Perform a lightweight operation to keep the service worker active
    chrome.storage.local.get(['lastActive'], () => {
      chrome.storage.local.set({ 
        lastActive: Date.now() 
      });
    });
  }
});

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Received message:', {
    type: message.type,
    from: sender.url,
    tabId: sender.tab?.id
  });

  if (message.type === 'VIDEO_COMPLETED') {
    handleVideoCompletion(sender.tab?.id, sender.tab?.url);
  } else if (message.type === 'ADD_TO_QUEUE') {
    console.log('Background: Processing ADD_TO_QUEUE message:', {
      itemType: message.item.type,
      title: message.item.title,
      episodeNumber: 'episodeNumber' in message.item ? message.item.episodeNumber : undefined
    });

    handleAddToQueue(message.item)
      .then(result => {
        console.log('Background: Queue item processed:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background: Error processing queue item:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (message.type === 'REMOVE_FROM_QUEUE') {
    console.log('Background: Processing REMOVE_FROM_QUEUE message:', {
      itemType: message.item.type,
      title: message.item.title,
      episodeNumber: 'episodeNumber' in message.item ? message.item.episodeNumber : undefined
    });

    handleRemoveFromQueue(message.item)
      .then(result => {
        console.log('Background: Queue item removed:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background: Error removing queue item:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  } else if (message.type === 'CLEAR_QUEUE') {
    console.log('Background: Processing CLEAR_QUEUE message');

    handleClearQueue()
      .then(result => {
        console.log('Background: Queue cleared:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background: Error clearing queue:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  return false;
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

async function handleAddToQueue(item: any) {
  console.log('Background: Handling add to queue:', {
    type: item.type,
    title: item.title
  });

  try {
    // Initialize storage service
    const storage = StorageService.getInstance();
    if (!storage) {
      throw new Error('Failed to initialize storage service');
    }

    // Store the item
    await storage.addItem(item);
    console.log('Background: Item stored successfully');

    // Notify any open popup/tabs
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('/index.html') });
    console.log('Background: Found React tabs:', tabs.length);

    if (tabs.length > 0) {
      for (const tab of tabs) {
        console.log('Background: Notifying tab:', tab.id);
        try {
          await chrome.tabs.sendMessage(tab.id!, {
            type: 'QUEUE_UPDATED',
            item
          });
          console.log('Background: Tab notified successfully');
        } catch (error) {
          console.warn('Background: Error notifying tab:', error instanceof Error ? error.message : String(error));
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Background: Error in handleAddToQueue:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleRemoveFromQueue(item: any) {
  console.log('Background: Handling remove from queue:', {
    type: item.type,
    title: item.title,
    id: item.id
  });

  try {
    // Initialize storage service
    const storage = StorageService.getInstance();
    if (!storage) {
      throw new Error('Failed to initialize storage service');
    }

    // Remove the item
    await storage.removeItem(item.id);
    console.log('Background: Item removed successfully');

    // Notify any open popup/tabs - include localhost URLs for development
    const tabs = await chrome.tabs.query({ 
      url: [
        chrome.runtime.getURL('/index.html'),
        '*://localhost:*/*'
      ] 
    });
    console.log('Background: Found React tabs:', tabs.length);

    if (tabs.length > 0) {
      for (const tab of tabs) {
        console.log('Background: Notifying tab:', tab.id);
        try {
          await chrome.tabs.sendMessage(tab.id!, {
            type: 'QUEUE_UPDATED'
          });
          console.log('Background: Tab notified successfully');
        } catch (error) {
          console.warn('Background: Error notifying tab:', error instanceof Error ? error.message : String(error));
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Background: Error in handleRemoveFromQueue:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handleClearQueue() {
  console.log('Background: Handling clear queue');

  try {
    // Initialize storage service
    const storage = StorageService.getInstance();
    if (!storage) {
      throw new Error('Failed to initialize storage service');
    }

    // Clear the queue
    await storage.clearQueue();
    console.log('Background: Queue cleared successfully');

    // Notify any open popup/tabs - include localhost URLs for development
    const tabs = await chrome.tabs.query({ 
      url: [
        chrome.runtime.getURL('/index.html'),
        '*://localhost:*/*'
      ] 
    });
    console.log('Background: Found React tabs:', tabs.length);

    if (tabs.length > 0) {
      for (const tab of tabs) {
        console.log('Background: Notifying tab:', tab.id);
        try {
          await chrome.tabs.sendMessage(tab.id!, {
            type: 'QUEUE_UPDATED'
          });
          console.log('Background: Tab notified successfully');
        } catch (error) {
          console.warn('Background: Error notifying tab:', error instanceof Error ? error.message : String(error));
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Background: Error in handleClearQueue:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.universal_queue_state) {
    console.log('Background: Queue state changed, notifying web app');
    
    // Notify all tabs running our web app
    chrome.tabs.query({ url: '*://localhost:*/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'QUEUE_STATE_UPDATE',
            state: changes.universal_queue_state.newValue
          }).catch(err => console.warn('Failed to send state to tab:', err));
        }
      });
    });
  }
}); 