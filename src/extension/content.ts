import { ServiceConfig, QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';

class ContentManager {
  private uiElements: Set<HTMLElement> = new Set();
  private currentUrl: string;
  private initTimeout: number | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;
  private configs: Record<string, ServiceConfig>;
  private disposed = false;

  constructor(configs: Record<string, ServiceConfig>) {
    this.configs = configs;
    this.currentUrl = window.location.href;
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    
    this.setupStyles();
    this.setupHistoryListeners();
    this.init().catch(this.handleError);
  }

  private readonly STYLES = `
    .universal-queue-add-button {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #646cff;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      z-index: 9999;
      transition: background-color 0.2s;
    }
    .universal-queue-add-button:hover {
      background: #535bf2;
    }
    .universal-queue-series-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #646cff;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      z-index: 9999;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .universal-queue-series-button:hover {
      background: #535bf2;
    }
  `;

  private setupStyles(): void {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = this.STYLES;
    document.head.appendChild(this.styleElement);
  }

  private setupHistoryListeners(): void {
    // Safely wrap history methods
    history.pushState = (...args) => {
      this.originalPushState.apply(history, args);
      this.handleUrlChange();
    };

    history.replaceState = (...args) => {
      this.originalReplaceState.apply(history, args);
      this.handleUrlChange();
    };

    window.addEventListener('popstate', this.handleUrlChange.bind(this));
  }

  private handleUrlChange = (): void => {
    const newUrl = window.location.href;
    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;
      this.init().catch(this.handleError);
    }
  };

  private createAddButton(item: QueueItem): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'universal-queue-add-button';
    button.innerHTML = '+';
    button.title = 'Add to Universal Queue';
    
    button.addEventListener('click', async () => {
      try {
        const storage = StorageService.getInstance();
        await storage.addItem(item);
        this.showSuccess(button);
      } catch (error) {
        this.handleError(error);
        this.showError(button);
      }
    });

    this.uiElements.add(button);
    return button;
  }

  private createSeriesButton(episodes: QueueItem[]): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'universal-queue-series-button';
    button.innerHTML = `Add ${episodes.length} Unwatched Episodes to Queue`;
    button.title = 'Add all unwatched episodes to Universal Queue';
    
    button.addEventListener('click', async () => {
      try {
        const storage = StorageService.getInstance();
        await Promise.all(episodes.map(episode => storage.addItem(episode)));
        this.showSuccess(button, `✓ Added ${episodes.length} Episodes to Queue`);
      } catch (error) {
        this.handleError(error);
        this.showError(button);
      }
    });

    this.uiElements.add(button);
    return button;
  }

  private showSuccess(element: HTMLElement, text?: string): void {
    if (this.disposed) return;
    
    const originalBackground = element.style.background;
    const originalContent = element.innerHTML;

    element.style.background = '#4CAF50';
    element.innerHTML = text || '✓';

    setTimeout(() => {
      if (!this.disposed) {
        element.style.background = originalBackground;
        element.innerHTML = originalContent;
      }
    }, 2000);
  }

  private showError(element: HTMLElement): void {
    element.style.background = '#dc3545';
    element.innerHTML = '!';
    element.title = 'Failed to add to queue. Please try again.';
  }

  private cleanup(): void {
    if (this.initTimeout) {
      window.clearTimeout(this.initTimeout);
      this.initTimeout = null;
    }

    this.uiElements.forEach(element => {
      try {
        element.remove();
      } catch (error) {
        console.error('Error removing element:', error);
      }
    });
    this.uiElements.clear();
  }

  private async extractContent(config: ServiceConfig): Promise<QueueItem | QueueItem[] | null> {
    try {
      if (config.isSeries?.()) {
        return await config.getSeriesData?.() || null;
      }

      const titleElement = document.querySelector(config.titleSelector);
      const thumbnailElement = config.thumbnailSelector ? 
        document.querySelector(config.thumbnailSelector) as HTMLImageElement : 
        null;
      
      if (!titleElement) return null;

      return {
        id: Date.now().toString(),
        title: titleElement.textContent?.trim() || '',
        type: 'movie',
        url: window.location.href,
        service: config.name,
        thumbnailUrl: thumbnailElement?.src || '',
        addedAt: Date.now(),
        order: 0
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private async init(delay = 1000): Promise<void> {
    if (this.disposed) return;

    if (this.initTimeout) {
      window.clearTimeout(this.initTimeout);
    }

    return new Promise((resolve) => {
      this.initTimeout = window.setTimeout(async () => {
        try {
          const url = window.location.href;
          const service = Object.entries(this.configs).find(([domain]) => 
            url.includes(domain)
          );

          if (!service) {
            console.log('DEBUG: No service config found for this domain');
            return;
          }

          this.cleanup();

          const config = service[1];
          const items = await this.extractContent(config);
          
          if (!items || this.disposed) return;

          const itemsArray = Array.isArray(items) ? items : [items];
          
          if (config.isSeries?.()) {
            const seriesButton = this.createSeriesButton(itemsArray);
            document.body.appendChild(seriesButton);
          }
          
          itemsArray.forEach(item => {
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
              const container = video.parentElement;
              if (!container || this.disposed) return;

              const button = this.createAddButton(item);
              container.style.position = 'relative';
              container.appendChild(button);
            });
          });
        } catch (error) {
          this.handleError(error);
        } finally {
          resolve();
        }
      }, delay);
    });
  }

  private handleError(error: unknown): void {
    console.error('Universal Queue Error:', error);
    // Could add error reporting service here
  }

  public dispose(): void {
    this.disposed = true;
    this.cleanup();
    
    // Restore original history methods
    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;
    
    // Remove styles
    this.styleElement?.remove();
    
    // Remove event listeners
    window.removeEventListener('popstate', this.handleUrlChange);
  }
}

// Import service configs
import { NetflixService } from './services/netflix';
import { YouTubeService } from './services/youtube';
import { DisneyPlusService } from './services/disneyplus';
import { PrimeVideoService } from './services/primevideo';
import { MaxService } from './services/max';
import { HuluService } from './services/hulu';
import { AppleTVService } from './services/appletv';

const serviceConfigs: Record<string, ServiceConfig> = {
  'netflix.com': new NetflixService().getConfig(),
  'youtube.com': new YouTubeService().getConfig(),
  'disneyplus.com': new DisneyPlusService().getConfig(),
  'primevideo.com': new PrimeVideoService().getConfig(),
  'max.com': new MaxService().getConfig(),
  'hulu.com': new HuluService().getConfig(),
  'tv.apple.com': new AppleTVService().getConfig()
};

// Initialize and store instance for cleanup
const contentManager = new ContentManager(serviceConfigs);

// Cleanup on extension unload
window.addEventListener('unload', () => {
  contentManager.dispose();
}); 