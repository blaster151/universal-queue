import { QueueState, QueueItem } from './types';

const STORAGE_KEY = 'universal_queue_state';

export class StorageService {
  private static instance: StorageService;
  private isExtensionContext: boolean;
  private isServiceWorker: boolean;
  private initialized: boolean = false;

  private constructor() {
    // Check if we're in a service worker context
    this.isServiceWorker = typeof window === 'undefined';
    
    // Check if we're in the extension context (background, content script, or popup)
    this.isExtensionContext = this.isServiceWorker || (typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined);
    
    // In extension context, verify chrome.storage is available
    if (this.isExtensionContext && !chrome?.storage?.local) {
      throw new Error('Chrome storage is not available in extension context');
    }
    
    // In web context, verify localStorage is available
    if (!this.isExtensionContext && !this.isServiceWorker && typeof window !== 'undefined' && !window.localStorage) {
      throw new Error('localStorage is not available in web context');
    }

    // Set up message listener for web context
    if (!this.isExtensionContext && !this.isServiceWorker && typeof window !== 'undefined') {
      // Listen for updates from the extension
      window.addEventListener('message', async (event) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'QUEUE_STATE_UPDATE') {
          console.log('Web: Received queue state update:', event.data.state);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event.data.state));
          // Dispatch event for React components to update
          window.dispatchEvent(new CustomEvent('queueStateChanged'));
        }
      });
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private async initializeWebStorage(): Promise<void> {
    if (this.initialized || this.isExtensionContext || this.isServiceWorker) return;

    // Request initial state from extension
    console.log('Web: Requesting initial state from extension');
    window.postMessage({ type: 'REQUEST_QUEUE_STATE' }, window.location.origin);
    
    // Wait for response or timeout after 2 seconds
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Web: Timeout waiting for extension response, using localStorage');
        resolve();
      }, 2000);

      const handler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'QUEUE_STATE_UPDATE') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve();
        }
      };

      window.addEventListener('message', handler);
    });

    this.initialized = true;
  }

  public async getQueueState(): Promise<QueueState> {
    if (this.isExtensionContext) {
      return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          const state = result[STORAGE_KEY] || { items: [], lastUpdated: Date.now() };
          // In extension context but not service worker, broadcast state to web app
          if (!this.isServiceWorker && chrome.tabs) {
            chrome.tabs.query({ url: '*://localhost:*/*' }, (tabs) => {
              tabs.forEach(tab => {
                if (tab.id) {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'QUEUE_STATE_UPDATE',
                    state
                  }).catch(err => console.warn('Failed to send state to tab:', err));
                }
              });
            });
          }
          resolve(state);
        });
      });
    } else {
      // Ensure we've initialized web storage
      await this.initializeWebStorage();
      const data = window.localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { items: [], lastUpdated: Date.now() };
    }
  }

  public async saveQueueState(state: QueueState): Promise<void> {
    if (this.isExtensionContext) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
          // After saving, broadcast to web app if not in service worker
          if (!this.isServiceWorker && chrome.tabs) {
            chrome.tabs.query({ url: '*://localhost:*/*' }, (tabs) => {
              tabs.forEach(tab => {
                if (tab.id) {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'QUEUE_STATE_UPDATE',
                    state
                  }).catch(err => console.warn('Failed to send state to tab:', err));
                }
              });
            });
          }
          resolve();
        });
      });
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  public async addItem(item: QueueItem): Promise<void> {
    const state = await this.getQueueState();
    state.items.push(item);
    state.lastUpdated = Date.now();
    await this.saveQueueState(state);
  }

  public async updateItemOrder(items: QueueItem[]): Promise<void> {
    const state = await this.getQueueState();
    state.items = items;
    state.lastUpdated = Date.now();
    await this.saveQueueState(state);
  }
} 