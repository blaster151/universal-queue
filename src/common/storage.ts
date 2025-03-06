import { QueueState, QueueItem } from './types';

const STORAGE_KEY = 'universal_queue_state';

export class StorageService {
  private static instance: StorageService;
  private storage: chrome.storage.LocalStorageArea | Storage;

  private constructor() {
    // Use chrome.storage in extension context, localStorage in web context
    this.storage = typeof chrome !== 'undefined' && chrome.storage
      ? chrome.storage.local
      : window.localStorage;
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async getQueueState(): Promise<QueueState> {
    if (this.storage instanceof Storage) {
      const data = this.storage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { items: [], lastUpdated: Date.now() };
    } else {
      return new Promise((resolve) => {
        this.storage.get(STORAGE_KEY, (result: { [key: string]: QueueState }) => {
          resolve(result[STORAGE_KEY] || { items: [], lastUpdated: Date.now() });
        });
      });
    }
  }

  public async saveQueueState(state: QueueState): Promise<void> {
    if (this.storage instanceof Storage) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      return new Promise((resolve) => {
        this.storage.set({ [STORAGE_KEY]: state }, resolve);
      });
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