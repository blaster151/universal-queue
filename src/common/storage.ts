import { QueueState, QueueItem } from './types';

const STORAGE_KEY = 'universal_queue_state';

export class StorageService {
  private static instance: StorageService;
  private isExtensionContext: boolean;

  private constructor() {
    // Check if we're in the extension context (background, content script, or popup)
    this.isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
    
    // In extension context, verify chrome.storage is available
    if (this.isExtensionContext && !chrome?.storage?.local) {
      throw new Error('Chrome storage is not available in extension context');
    }
    
    // In web context, verify localStorage is available
    if (!this.isExtensionContext && typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available in web context');
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async getQueueState(): Promise<QueueState> {
    if (this.isExtensionContext) {
      return new Promise((resolve) => {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          resolve(result[STORAGE_KEY] || { items: [], lastUpdated: Date.now() });
        });
      });
    } else {
      const data = window.localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { items: [], lastUpdated: Date.now() };
    }
  }

  public async saveQueueState(state: QueueState): Promise<void> {
    if (this.isExtensionContext) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: state }, resolve);
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