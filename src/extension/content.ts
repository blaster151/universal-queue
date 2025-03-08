import { ServiceConfig, QueueItem } from '@/common/types';

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

export class ContentManager {
  private currentUrl: string = '';
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;
  private service: ServiceConfig | null = null;

  constructor(private readonly serviceConfigs: Record<string, ServiceConfig>) {
    console.log('ContentManager initializing...');
    this.currentUrl = window.location.href;
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    this.injectStyles();
    this.init();
  }

  private injectStyles(): void {
    const styles = `
      .universal-queue-button {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background-color: #e50914;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .universal-queue-button:hover {
        background-color: #f40612;
      }

      .universal-queue-button:disabled {
        background-color: #888;
        cursor: not-allowed;
      }

      .universal-queue-button.added {
        background-color: #2ecc71;
      }

      .universal-queue-button.error {
        background-color: #e74c3c;
      }
    `;

    // Add a data attribute to identify our injected styles for cleanup
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-source', 'universal-queue');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  private async init(): Promise<void> {
    try {
      this.service = this.detectService(this.currentUrl);
      
      // Add delay for Netflix to load content
      if (this.currentUrl.includes('netflix.com')) {
        console.log('Content: Waiting for Netflix to load...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      if (this.service?.isSeries?.()) {
        console.log('Content: Detected series page');
        const seriesData = await this.service.getSeriesData?.();
        
        if (seriesData && 'episodes' in seriesData) {
          console.log('Content: Creating series button with data:', {
            title: seriesData.title,
            episodeCount: seriesData.episodeCount
          });
          try {
            const seriesButton = this.createSeriesButton(seriesData);
            document.body.appendChild(seriesButton);
            console.log('Content: Series button added to page');
          } catch (error) {
            console.error('Content: Error creating/adding button:', error instanceof Error ? error.message : String(error));
          }
        } else {
          console.warn('Content: Invalid series data received');
        }
      }
    } catch (error) {
      console.error('Content: Error initializing:', error instanceof Error ? error.message : String(error));
    }
  }

  private createSeriesButton(seriesData: { title: string; episodes: QueueItem[]; episodeCount: number }): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = 'Add Series to Queue';
    button.classList.add('universal-queue-button');
    
    // Add click handler for series
    button.addEventListener('click', async () => {
      console.log('Content: Series button clicked');
      await this.handleSeriesClick(button, seriesData);
    });

    return button;
  }

  private async handleSeriesClick(
    button: HTMLButtonElement, 
    seriesData: { title: string; episodes: QueueItem[]; episodeCount: number }
  ): Promise<void> {
    console.log('Content: Series button clicked:', {
      title: seriesData.title,
      episodeCount: seriesData.episodeCount
    });

    try {
      // Update button state
      button.disabled = true;
      button.textContent = 'Adding Series...';
      console.log('Content: Series button state updated to loading');

      // Add each episode to queue
      console.log('Content: Starting to add episodes');
      const episodes = seriesData.episodes || [];
      for (const episode of episodes) {
        console.log('Content: Adding episode:', {
          number: 'episodeNumber' in episode ? episode.episodeNumber : undefined,
          title: episode.title
        });
        await this.addToQueue(episode, button);
      }

      // Update button state after all episodes added
      button.textContent = 'Series Added';
      button.classList.add('added');
      console.log('Content: All episodes added successfully');
    } catch (error) {
      console.error('Content: Error adding series:', error instanceof Error ? error.message : String(error));
      button.textContent = 'Error - Try Again';
      button.classList.add('error');
      button.disabled = false;
    }
  }

  private async addToQueue(episode: QueueItem, button: HTMLButtonElement): Promise<void> {
    console.log('Content: Adding to queue:', {
      type: episode.type,
      title: episode.title,
      episodeNumber: 'episodeNumber' in episode ? episode.episodeNumber : undefined,
      seriesTitle: 'seriesTitle' in episode ? episode.seriesTitle : undefined
    });

    try {
      // Disable button and show loading state
      button.disabled = true;
      button.textContent = 'Adding...';
      console.log('Content: Button state updated to loading');

      // Send message to background script
      console.log('Content: Sending message to background script');
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TO_QUEUE',
        item: episode
      });
      console.log('Content: Received response from background:', response);

      // Update button state based on response
      if (response?.success) {
        button.textContent = 'Added to Queue';
        button.classList.add('added');
        console.log('Content: Item successfully added to queue');
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Content: Error adding to queue:', error instanceof Error ? error.message : String(error));
      button.textContent = 'Error - Try Again';
      button.classList.add('error');
      button.disabled = false;
    }
  }

  private detectService(url: string): ServiceConfig | null {
    const hostname = new URL(url).hostname;
    return Object.entries(this.serviceConfigs).find(([domain]) => hostname.includes(domain))?.[1] ?? null;
  }

  /**
   * Cleanup method that removes all extension-related elements and restores original state
   * Called when:
   * 1. The extension is disabled/unloaded
   * 2. The page is unloaded (via unload event listener)
   * 3. Explicitly called during cleanup operations
   */
  public dispose(): void {
    console.log('Content: Disposing ContentManager...');
    
    // Find and remove all style elements we injected
    // We use the data-source attribute to ensure we only remove our styles
    document.querySelectorAll('style[data-source="universal-queue"]')
      .forEach(el => {
        console.log('Content: Removing injected styles');
        el.remove();
      });
    
    // Find and remove all buttons we created
    // Using the universal-queue-button class to identify our elements
    document.querySelectorAll('.universal-queue-button')
      .forEach(el => {
        console.log('Content: Removing universal queue button');
        el.remove();
      });
      
    // Restore the original history methods to prevent memory leaks
    // and ensure proper cleanup of our URL monitoring
    if (this.originalPushState) {
      console.log('Content: Restoring original pushState');
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      console.log('Content: Restoring original replaceState');
      history.replaceState = this.originalReplaceState;
    }

    console.log('Content: ContentManager disposed');
  }
}

// Create a single instance of the ContentManager
// This ensures we don't create multiple buttons or event listeners
const contentManager = new ContentManager(serviceConfigs);

// Register cleanup handler for when the page is unloaded
// This ensures we don't leave any elements behind when navigating away
window.addEventListener('unload', () => {
  contentManager.dispose();
}); 