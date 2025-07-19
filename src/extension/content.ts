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
  'amazon.com': new PrimeVideoService(),
  'max.com': new MaxService(),
  'hulu.com': new HuluService(),
  'tv.apple.com': new AppleTVService()
};

export class ContentManager {
  private originalPushState: typeof history.pushState;
  private originalReplaceState: typeof history.replaceState;
  private service: BaseStreamingService | null = null;
  private cleanupFunctions: Array<() => void> = [];

  constructor(private readonly services: Record<string, BaseStreamingService>) {
    console.log('ContentManager initializing...', {
      currentUrl: window.location.href,
      availableServices: Object.keys(services),
      matchingService: Object.keys(services).find(domain => window.location.hostname.includes(domain))
    });
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
        background-color: #646cff;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .uq-button-container {
        position: absolute !important;
        top: 0 !important;
        right: 0 !important;
        z-index: 9999 !important;
      }

      .universal-queue-button.episode-button {
        position: relative !important;
        top: 8px !important;
        right: 8px !important;
        padding: 4px 8px !important;
        font-size: 12px !important;
        opacity: 1 !important;
        background-color: rgba(100, 108, 255, 0.9) !important;
        border-radius: 4px !important;
        z-index: 99999 !important;
        border: none !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }

      /* Disney+ specific styles */
      [data-testid="set-item"] {
        position: relative !important;
      }

      [data-testid="set-item"] .uq-button-container {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
      }

      /* Max specific styles */
      .StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31 {
        position: relative !important;
      }

      .StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31 .uq-button-container {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      /* Hide button container until hover */
      .StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31 .uq-button-container {
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
      }

      .StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31:hover .uq-button-container {
        opacity: 1;
      }

      .universal-queue-button:hover {
        background-color: #535bf2;
        transform: scale(1.05);
      }

      .universal-queue-button:disabled {
        background-color: #888;
        cursor: not-allowed;
        transform: none;
      }

      .universal-queue-button.added {
        background-color: #4CAF50;
      }

      .universal-queue-button.error {
        background-color: #e74c3c;
      }

      .universal-queue-button.episode-button:hover {
        background-color: rgba(83, 91, 242, 0.95);
      }

      .universal-queue-button.episode-button.added {
        background-color: rgba(76, 175, 80, 0.9);
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

  private detectService(): { domain: string; service: BaseStreamingService } | null {
    const hostname = window.location.hostname;
    const serviceDomain = Object.keys(this.services).find(domain => hostname.includes(domain));
    
    if (!serviceDomain || !this.services[serviceDomain]) {
      return null;
    }

    return {
      domain: serviceDomain,
      service: this.services[serviceDomain]
    };
  }

  private async getPageType(): Promise<string> {
    if (!this.service) return 'Unknown Page';
    
    const config = this.service.getConfig();
    const isSeries = await config.isSeries();
    const isMovie = await config.isMovie?.() || false;
    const isList = await config.isList?.() || false;

    if (isSeries) return 'Series Page';
    if (isMovie) return 'Movie Page';
    if (isList) return 'List Page';
    return 'Other Page';
  }

  private async init(): Promise<void> {
    const DEBUG_EMOJI = {
      NO_SERVICE: '🚫',
      SERVICE: '🎬'
    } as const;

    console.log('ContentManager initializing...', {
      currentUrl: window.location.href,
      availableServices: Object.keys(this.services),
      matchingService: this.service?.getConfig().name
    });

    // Add debug overlay
    const debugOverlay = document.createElement('div');
    debugOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 8px 16px;
      font-family: monospace;
      z-index: 999999;
      font-size: 14px;
      pointer-events: none;
    `;
    document.body.appendChild(debugOverlay);

    const updateDebugInfo = async () => {
      if (!this.service) {
        debugOverlay.textContent = `${DEBUG_EMOJI.NO_SERVICE} No streaming service detected`;
        return;
      }

      const serviceName = this.service.getConfig().name.toUpperCase();
      const pageType = await this.getPageType();
      debugOverlay.textContent = `${DEBUG_EMOJI.SERVICE} ${serviceName}: ${pageType}`;
    };

    console.log('ContentManager init starting...');
    
    // Update service detection to use the new type-safe method
    const serviceDetection = this.detectService();
    console.log('ContentManager service detection:', {
      hostname: window.location.hostname,
      serviceDomain: serviceDetection?.domain,
      hasService: !!serviceDetection
    });

    if (serviceDetection) {
      this.service = serviceDetection.service;
      const config = this.service.getConfig();
      const checkIsSeries = config.isSeries;
      
      console.log('ContentManager service initialized:', {
        name: config.name,
        hasIsSeries: !!checkIsSeries
      });
      
      // Set initialization flag
      (window as any).__UNIVERSAL_QUEUE_INITIALIZED = true;
      
      if (checkIsSeries) {
        const isSeries = await checkIsSeries();
        console.log('ContentManager initial series check:', {
          isSeries,
          hasGetSeriesData: !!config.getSeriesData
        });
        
        if (isSeries && config.getSeriesData) {
          const seriesData = await config.getSeriesData();
          console.log('ContentManager got series data:', {
            hasData: !!seriesData,
            episodeCount: Array.isArray(seriesData) ? seriesData.length : 0
          });
          
          await this.handleSeriesData(seriesData);
        }
      }
    }

    // Update debug info after service detection
    await updateDebugInfo();
  }

  private async handleSeriesData(seriesData: any): Promise<void> {
    if (!seriesData || !Array.isArray(seriesData)) {
      console.log('ContentManager: No valid series data to handle');
      return;
    }

    console.log('ContentManager: Handling series data:', {
      episodeCount: seriesData.length
    });

    const storage = StorageService.getInstance();
    const queueState = await storage.getQueueState();
    
    seriesData.forEach((episode: QueueItem) => {
      console.log('ContentManager: Processing episode:', {
        id: episode.id,
        title: episode.title,
        number: episode.episodeNumber
      });
      
      const episodeId = `episode-${episode.id}`;
      
      // Check if we already have a button for this episode
      if (document.querySelector(`[data-uq-button="${episodeId}"]`)) {
        console.log('ContentManager: Button already exists for episode:', episodeId);
        return;
      }

      const isQueued = queueState.items.some(item => 
        item.type === 'episode' &&
        (item as EpisodeItem).seriesTitle === (episode as EpisodeItem).seriesTitle &&
        (item as EpisodeItem).episodeNumber === (episode as EpisodeItem).episodeNumber
      );

      const episodeButton = this.createEpisodeButton(episode, isQueued);
      episodeButton.setAttribute('data-uq-button', episodeId);
      
      // Only try to find episode element if this is an episode type
      if (episode.type === 'episode') {
        const episodeElement = this.findEpisodeElement(episode as EpisodeItem);
        if (episodeElement) {
          // Check if we already have a button container
          let buttonContainer = episodeElement.querySelector('.uq-button-container') as HTMLDivElement;
          if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'uq-button-container';
            buttonContainer.style.position = 'relative';
            episodeElement.appendChild(buttonContainer);
            console.log('ContentManager: Created new button container for episode:', episodeId);
          } else {
            // Clear any existing buttons in the container
            buttonContainer.innerHTML = '';
            console.log('ContentManager: Cleared existing button container for episode:', episodeId);
          }
          buttonContainer.appendChild(episodeButton);
          console.log('ContentManager: Added button to container for episode:', episodeId);
        }
      }
    });
  }

  private findEpisodeElement(episode: EpisodeItem): Element | null {
    // Get service-specific selectors
    const serviceSelectors: Record<string, string[]> = {
      'netflix': [
        `.titleCardList--container[aria-label*="Episode ${episode.episodeNumber}"]`,
        `.titleCard--container[aria-label*="Episode ${episode.episodeNumber}"]`,
        `[data-uia="episode-item-${episode.episodeNumber}"]`,
        `[data-uia*="episode-${episode.episodeNumber}"]`,
        `[class*="episode-item-${episode.episodeNumber}"]`
      ],
      'disneyplus': [
        `[data-testid="set-item"][href*="${episode.id}"]`,
        `[data-testid="set-item"]`
      ],
      'max': [
        `[class*="StyledTileWrapper"][href*="${episode.id}"]`,
        `[class*="StyledTileWrapper"]`,
        `[class*="EpisodeTile"]`,
        `[class*="episode-tile"]`
      ],
      'primevideo': [
        `[data-testid="episode-list-item"][data-aliases*="${episode.id}"]`,
        `[data-testid="episode-list-item"]:has([data-testid="episodes-playbutton"][href*="${episode.id}"])`,
        `[data-testid="episode-list-item"]`
      ],
      'hulu': [
        `[data-testid="seh-tile"]:has([data-testid="watchaction-btn"][href*="${episode.id}"])`,
        `[data-testid="seh-tile"]`
      ]
    };

    // Get selectors for this service
    const selectors = serviceSelectors[episode.service] || [];
    
    // Add title-based selectors if we have a title
    if (episode.title) {
      const escapedTitle = episode.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      selectors.push(
        // Netflix
        `.titleCardList--container[aria-label*="${escapedTitle}"]`,
        `.titleCard--container[aria-label*="${escapedTitle}"]`,
        // Disney+
        `[data-testid="set-item"]:has([data-testid="standard-regular-list-item-title"]:contains("${escapedTitle}"))`,
        // Max
        `[class*="StyledTileWrapper"]:has([class*="StyledTitle"]:contains("${escapedTitle}"))`,
        // Prime Video
        `[data-testid="episode-list-item"]:has(.P1uAb6:contains("${escapedTitle}"))`,
        // Hulu
        `[data-testid="seh-tile"]:has([data-testid="seh-tile-content-title"]:contains("${escapedTitle}"))`
      );
    }

    // Try each selector
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          console.log('Content: Found episode element with selector:', selector);
          return element;
        }
      } catch (error) {
        console.warn('Content: Invalid selector:', selector, error);
      }
    }

    console.warn('Content: Could not find element for episode:', {
      service: episode.service,
      id: episode.id,
      number: episode.episodeNumber,
      title: episode.title,
      triedSelectors: selectors
    });

    return null;
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