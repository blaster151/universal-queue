import { QueueItem, EpisodeItem } from '../common/types';
import { BaseStreamingService } from './services/base';

// Import service configs
import { NetflixService } from './services/netflix';
import { YouTubeService } from './services/youtube';
import { DisneyPlusService } from './services/disneyplus';
import { PrimeVideoService } from './services/primevideo';
import { MaxService } from './services/max';
import { HuluService } from './services/hulu';
import { AppleTVService } from './services/appletv';
import { StorageService } from '../common/storage';

// Store service instances instead of just configs
const services: Record<string, BaseStreamingService> = {
  'netflix.com': new NetflixService(),
  'youtube.com': new YouTubeService(),
  'disneyplus.com': new DisneyPlusService(),
  'primevideo.com': new PrimeVideoService(),
  'max.com': new MaxService(),
  'hulu.com': new HuluService(),
  'tv.apple.com': new AppleTVService()
};

export class ContentManager {
  private currentUrl: string = '';
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;
  private service: BaseStreamingService | null = null;
  private cleanupFunctions: Array<() => void> = [];

  constructor(private readonly services: Record<string, BaseStreamingService>) {
    console.log('ContentManager initializing...');
    this.currentUrl = window.location.href;
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    this.injectStyles();
    this.init();
    this.setupCleanup();
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
        transition: all 0.2s;
      }

      /* Debug styles - will remove later */
      .titleCard--container,
      .titleCardList--container {
        border: 2px solid yellow !important;
        position: relative !important;
      }

      .titleCard--metadataWrapper {
        border: 2px solid blue !important;
        position: relative !important;
      }

      .universal-queue-button.episode-button {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
        padding: 4px 8px !important;
        font-size: 12px !important;
        opacity: 1 !important; /* Force visible for debugging */
        background-color: rgba(229, 9, 20, 0.9) !important;
        border-radius: 2px !important;
        z-index: 99999 !important;
        border: 2px solid lime !important;
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

      .titleCard--container:hover .universal-queue-button.episode-button,
      .titleCardList--container:hover .universal-queue-button.episode-button {
        opacity: 1;
      }

      .universal-queue-button.episode-button:hover {
        background-color: rgba(244, 6, 18, 0.9);
      }

      .universal-queue-button.episode-button.added {
        background-color: rgba(46, 204, 113, 0.9);
      }

      .universal-queue-button.episode-button.error {
        background-color: rgba(231, 76, 60, 0.9);
      }
    `;

    // Add a data attribute to identify our injected styles for cleanup
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-source', 'universal-queue');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  private addCleanup(fn: () => void) {
    this.cleanupFunctions.push(fn);
  }

  private setupCleanup() {
    // Clean up when the page is unloaded
    const unloadHandler = () => this.dispose();
    window.addEventListener('unload', unloadHandler);
    this.addCleanup(() => window.removeEventListener('unload', unloadHandler));

    // Clean up when the extension is disabled/removed
    const portDisconnectHandler = () => this.dispose();
    chrome.runtime.onConnect.addListener(port => {
      port.onDisconnect.addListener(portDisconnectHandler);
      this.addCleanup(() => port.onDisconnect.removeListener(portDisconnectHandler));
    });
  }

  private async init(): Promise<void> {
    try {
      this.service = this.detectService(this.currentUrl);
      console.log('Content: Service detection result:', {
        serviceName: this.service?.constructor.name,
        hasService: !!this.service
      });
      
      // Add delay for Netflix to load content
      if (this.currentUrl.includes('netflix.com')) {
        console.log('Content: Waiting for Netflix to load...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const config = this.service?.getConfig();
      console.log('Content: Got service config:', {
        hasConfig: !!config,
        configName: config?.name,
        hasIsSeries: !!config?.isSeries
      });

      if (!config) {
        console.error('Content: No config available from service');
        return;
      }

      if (!config.isSeries) {
        console.error('Content: Service config does not have isSeries method');
        return;
      }

      const isSeries = await Promise.resolve(config.isSeries());
      console.log('Content: isSeries check result:', isSeries);
      
      if (isSeries) {
        console.log('Content: Detected series page, getting series data...');
        if (!config.getSeriesData) {
          console.error('Content: Service config does not have getSeriesData method');
          return;
        }
        const seriesData = await Promise.resolve(config.getSeriesData());
        console.log('Content: Got series data:', {
          hasData: !!seriesData,
          title: seriesData?.title,
          episodeCount: seriesData?.episodeCount
        });
        
        if (seriesData && 'episodes' in seriesData) {
          console.log('Content: Creating series button with data:', {
            title: seriesData.title,
            episodeCount: seriesData.episodeCount
          });
          try {
            // Get current queue state to check for existing episodes
            const storage = StorageService.getInstance();
            const queueState = await storage.getQueueState();
            
            // Create series-wide button
            const seriesButton = this.createSeriesButton(seriesData);
            document.body.appendChild(seriesButton);
            console.log('Content: Series button added to page');

            // Create individual episode buttons
            console.log('Content: Creating individual episode buttons');
            seriesData.episodes.forEach((episode) => {
              // Check if episode is already in queue
              const isQueued = queueState.items.some(item => 
                item.type === 'episode' &&
                (item as EpisodeItem).seriesTitle === episode.seriesTitle &&
                (item as EpisodeItem).episodeNumber === episode.episodeNumber
              );

              const episodeButton = this.createEpisodeButton(episode, isQueued);
              // Try multiple selectors to find the episode element
              const selectors = [
                `.titleCardList--container[aria-label*="Episode ${episode.episodeNumber}"]`,
                `.titleCard--container[aria-label*="Episode ${episode.episodeNumber}"]`,
                `[data-uia="episode-item-${episode.episodeNumber}"]`,
                `[data-uia*="episode-${episode.episodeNumber}"]`,
                `[class*="episode-item-${episode.episodeNumber}"]`,
                // Find by title if number fails
                episode.title ? `.titleCardList--container[aria-label*="${episode.title}"]` : '',
                episode.title ? `.titleCard--container[aria-label*="${episode.title}"]` : ''
              ].filter(Boolean);

              console.log('Content: Trying selectors for episode', episode.episodeNumber, selectors);
              
              const episodeElement = document.querySelector(selectors.join(', '));
              if (episodeElement) {
                console.log('Content: Found episode element:', {
                  episodeNumber: episode.episodeNumber,
                  elementClasses: episodeElement.className,
                  elementId: episodeElement.id,
                  ariaLabel: episodeElement.getAttribute('aria-label'),
                  isQueued
                });

                // Find a good spot to insert the button
                const buttonContainer = episodeElement.querySelector('.titleCard--metadataWrapper') || episodeElement;
                buttonContainer.appendChild(episodeButton);
                console.log('Content: Added button for episode', episode.episodeNumber);
              } else {
                console.warn('Content: Could not find element for episode', episode.episodeNumber, 'with selectors:', selectors);
              }
            });
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
    console.log('Content: Adding to queue:', episode);

    try {
      // Disable button and show loading state
      button.disabled = true;
      button.textContent = 'Adding...';
      console.log('Content: Button state updated to loading');

      // Send complete episode data to background script
      console.log('Content: Sending message to background script');
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TO_QUEUE',
        item: {
          ...episode,
          addedAt: Date.now()
        }
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

  private async removeFromQueue(episode: QueueItem, button: HTMLButtonElement): Promise<void> {
    console.log('Content: Removing from queue:', {
      id: episode.id,
      type: episode.type,
      title: episode.title,
      episodeNumber: 'episodeNumber' in episode ? episode.episodeNumber : undefined
    });

    try {
      button.disabled = true;
      button.textContent = 'Removing...';

      // Get current queue state to find the correct item ID
      const storage = StorageService.getInstance();
      const state = await storage.getQueueState();
      const existingItem = state.items.find(item => 
        item.type === 'episode' &&
        'episodeNumber' in item &&
        'seriesTitle' in item &&
        item.seriesTitle === (episode as EpisodeItem).seriesTitle &&
        item.episodeNumber === (episode as EpisodeItem).episodeNumber
      );

      if (!existingItem) {
        throw new Error('Item not found in queue');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'REMOVE_FROM_QUEUE',
        item: existingItem
      });

      if (response?.success) {
        button.textContent = 'Add Episode';
        button.classList.remove('added');
        button.disabled = false;
        // Re-add the click handler for adding
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.addToQueue(episode, button);
        });
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Content: Error removing from queue:', error instanceof Error ? error.message : String(error));
      button.textContent = 'Error - Try Again';
      button.classList.add('error');
      button.disabled = false;
    }
  }

  private createEpisodeButton(episode: QueueItem, isQueued: boolean = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = isQueued ? 'In Queue' : 'Add Episode';
    button.classList.add('universal-queue-button', 'episode-button');
    if (isQueued) {
      button.classList.add('added');
    }

    // Add hover effect directly to the button instead of parent
    button.addEventListener('mouseenter', () => {
      if (isQueued) {
        button.textContent = 'Remove';
      }
    });
    button.addEventListener('mouseleave', () => {
      if (isQueued) {
        button.textContent = 'In Queue';
      }
    });

    // Add click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isQueued) {
        await this.removeFromQueue(episode, button);
      } else {
        await this.addToQueue(episode, button);
      }
    });

    return button;
  }

  private detectService(url: string): BaseStreamingService | null {
    console.log('Content: Detecting service for URL:', url);
    const hostname = new URL(url).hostname;
    console.log('Content: Hostname:', hostname);
    
    // Remove 'www.' prefix for consistent matching
    const normalizedHostname = hostname.replace(/^www\./, '');
    console.log('Content: Normalized hostname:', normalizedHostname);
    
    // Find the matching service
    const matchingService = Object.entries(this.services).find(([domain]) => {
      const matches = normalizedHostname === domain || normalizedHostname.endsWith('.' + domain);
      console.log('Content: Checking domain:', domain, 'matches:', matches);
      return matches;
    });
    
    if (matchingService) {
      console.log('Content: Found matching service:', matchingService[0]);
    } else {
      console.log('Content: No matching service found');
    }
    
    return matchingService?.[1] ?? null;
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

    // Run all cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];

    console.log('Content: ContentManager disposed');
  }
}

// Create a single instance of the ContentManager with service instances
const contentManager = new ContentManager(services);

// Register cleanup handler for when the page is unloaded
window.addEventListener('unload', () => {
  contentManager.dispose();
}); 