import { ServiceConfig, QueueItem } from '@/common/types';
import { UIManager } from './ui';

export class PageManager {
  private static instance: PageManager;
  private config: ServiceConfig | null = null;
  private uiManager: UIManager;

  private constructor() {
    this.uiManager = UIManager.getInstance();
  }

  public static getInstance(): PageManager {
    if (!PageManager.instance) {
      PageManager.instance = new PageManager();
    }
    return PageManager.instance;
  }

  public setConfig(config: ServiceConfig): void {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (!this.config) {
      console.log('DEBUG: No service config available');
      return;
    }

    // Clean up any existing UI
    this.uiManager.cleanup();

    const items = await this.extractContent();
    if (!items) {
      console.log('DEBUG: No content found on page');
      return;
    }

    this.injectUI(items);
  }

  private async extractContent(): Promise<QueueItem | QueueItem[] | null> {
    if (!this.config) return null;

    // Check if this is a series page
    if (this.config.isSeries?.()) {
      return this.config.getSeriesData?.() || null;
    }

    // Single video content
    const titleElement = document.querySelector(this.config.titleSelector) as HTMLElement;
    const thumbnailElement = this.config.thumbnailSelector ? 
      document.querySelector(this.config.thumbnailSelector) as HTMLImageElement : 
      null;
    
    if (!titleElement) return null;

    return {
      id: Date.now().toString(),
      title: titleElement.textContent?.trim() || '',
      type: 'movie',
      url: window.location.href,
      service: this.config.name,
      thumbnailUrl: thumbnailElement?.src || '',
      addedAt: Date.now(),
      order: 0
    };
  }

  private injectUI(items: QueueItem | QueueItem[]): void {
    const itemsArray = Array.isArray(items) ? items : [items];
    
    // Add series-wide button if this is a series
    if (this.config?.isSeries?.()) {
      this.uiManager.createSeriesButton(itemsArray);
    }
    
    // Add individual video buttons
    itemsArray.forEach(item => {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        const container = video.parentElement;
        if (container) {
          this.uiManager.createAddButton(item, container);
        }
      });
    });
  }

  public cleanup(): void {
    this.uiManager.cleanup();
  }

  public destroy(): void {
    this.uiManager.destroy();
  }
} 