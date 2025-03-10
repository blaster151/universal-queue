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

const SERVICES: Record<string, ServiceConfig> = {
  'netflix.com': {
    name: 'netflix',
    urlPattern: '*://*.netflix.com/*',
    titleSelector: '.video-title h4',
    thumbnailSelector: '.video-artwork img',
    durationSelector: '.duration',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => false,
    episodeInfo: {
      containerSelector: '.episode-item',
      titleSelector: '.episode-title',
      numberSelector: '.episode-number',
      synopsisSelector: '.episode-synopsis',
      durationSelector: '.episode-duration',
      progressSelector: '.progress-indicator'
    }
  },
  'youtube.com': {
    name: 'youtube',
    urlPattern: '*://*.youtube.com/*',
    titleSelector: '.video-title',
    thumbnailSelector: '.video-thumbnail img',
    durationSelector: '.duration',
    completionDetector: {
      type: 'event',
      value: 'onStateChange'
    },
    isSeries: () => false,
    episodeInfo: {
      containerSelector: '.episode-item',
      titleSelector: '.episode-title',
      numberSelector: '.episode-number',
      synopsisSelector: '.episode-synopsis',
      durationSelector: '.episode-duration',
      progressSelector: '.progress-indicator'
    }
  },
  'disneyplus.com': {
    name: 'disneyplus',
    urlPattern: '*://*.disneyplus.com/*',
    titleSelector: '.title-field',
    thumbnailSelector: '.artwork img',
    durationSelector: '.duration-field',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => false,
    episodeInfo: {
      containerSelector: '.episode-item',
      titleSelector: '.episode-title',
      numberSelector: '.episode-number',
      synopsisSelector: '.episode-synopsis',
      durationSelector: '.episode-duration',
      progressSelector: '.progress-indicator'
    }
  },
  'primevideo.com': {
    name: 'primevideo',
    urlPattern: '*://*.primevideo.com/*',
    titleSelector: '.title-field',
    thumbnailSelector: '.artwork img',
    durationSelector: '.duration-field',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => false,
    episodeInfo: {
      containerSelector: '.episode-item',
      titleSelector: '.episode-title',
      numberSelector: '.episode-number',
      synopsisSelector: '.episode-synopsis',
      durationSelector: '.episode-duration',
      progressSelector: '.progress-indicator'
    }
  }
};

class BackgroundScript {
  private storage = StorageService.getInstance();
  private cleanupFunctions: Array<() => void> = [];
  private ports: Map<number, chrome.runtime.Port> = new Map();

  constructor() {
    this.init();
    this.setupCleanup();
  }

  private addCleanup(fn: () => void) {
    this.cleanupFunctions.push(fn);
  }

  private setupCleanup() {
    // Clean up when the extension is disabled/removed
    chrome.runtime.onSuspend.addListener(() => this.dispose());
  }

  private init() {
    // Handle connections from content scripts
    chrome.runtime.onConnect.addListener(port => {
      const tabId = port.sender?.tab?.id;
      if (!tabId) return;

      this.ports.set(tabId, port);
      
      const messageHandler = (msg: any) => this.handleMessage(msg, port);
      port.onMessage.addListener(messageHandler);
      
      const disconnectHandler = () => {
        port.onMessage.removeListener(messageHandler);
        this.ports.delete(tabId);
      };
      
      port.onDisconnect.addListener(disconnectHandler);
      this.addCleanup(() => {
        port.onMessage.removeListener(messageHandler);
        port.onDisconnect.removeListener(disconnectHandler);
      });
    });

    // Handle video progress tracking
    chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkVideoProgress(tab);
      }
    });
  }

  private async checkVideoProgress(tab: chrome.tabs.Tab) {
    const video = document.createElement('video');
    const checkCompletion = () => {
      if (video.currentTime / video.duration > 0.9) {
        this.handleVideoComplete(tab.url!);
      }
    };

    video.addEventListener('timeupdate', checkCompletion);
    video.addEventListener('ended', () => this.handleVideoComplete(tab.url!));

    this.addCleanup(() => {
      video.removeEventListener('timeupdate', checkCompletion);
      video.removeEventListener('ended', () => this.handleVideoComplete(tab.url!));
    });
  }

  private async handleVideoComplete(url: string) {
    try {
      const state = await this.storage.getQueueState();
      const items = state.items.map(item => 
        item.url === url ? { ...item, completed: true } : item
      );
      await this.storage.saveQueueState({
        items,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Failed to mark item complete:', error);
    }
  }

  private async handleMessage(message: any, port: chrome.runtime.Port) {
    try {
      switch (message.type) {
        case 'ADD_TO_QUEUE':
          const state = await this.storage.getQueueState();
          await this.storage.saveQueueState({
            items: [...state.items, message.item],
            lastUpdated: Date.now()
          });
          break;
        case 'REMOVE_FROM_QUEUE':
          const currentState = await this.storage.getQueueState();
          await this.storage.saveQueueState({
            items: currentState.items.filter(item => item.id !== message.id),
            lastUpdated: Date.now()
          });
          break;
        // ... other message handlers ...
      }
    } catch (error) {
      console.error('Error handling message:', error);
      port.postMessage({ type: 'ERROR', error: error instanceof Error ? error.message : String(error) });
    }
  }

  public dispose() {
    // Close all ports
    this.ports.forEach(port => port.disconnect());
    this.ports.clear();

    // Run all cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}

// Initialize the background script
new BackgroundScript();

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

// Listen for tab updates to detect when a video is complete
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.id) {
    const url = new URL(tab.url);
    const service = Object.entries(SERVICES).find(([domain]) => 
      url.hostname.includes(domain)
    );

    if (!service) return;

    // Inject the completion detection script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectCompletionDetector,
      args: [service[0]]
    });

    handleVideoCompletion(tab.id);
  }
});

function injectCompletionDetector(domain: string) {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const video = document.querySelector('video');
      if (!video) return;

      const checkCompletion = () => {
        if (${SERVICES[domain].completionDetector.value}) {
          chrome.runtime.sendMessage({ type: 'VIDEO_COMPLETED' });
        }
      };

      if (SERVICES[domain].completionDetector.type === 'time') {
        video.addEventListener('timeupdate', checkCompletion);
      } else if (SERVICES[domain].completionDetector.type === 'event') {
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