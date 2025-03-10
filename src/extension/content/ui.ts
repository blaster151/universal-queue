import { QueueItem, EpisodeItem } from '@/common/types';
import { StorageService } from '@/common/storage';

const STYLES = `
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
  /* Max-specific styles */
  .max-episode-add-button {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(100, 108, 255, 0.95);
    color: white;
    border: 2px solid white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    z-index: 9999;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .max-episode-add-button:hover {
    background: rgba(83, 91, 242, 1);
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  }
  .max-series-button {
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(100, 108, 255, 0.9);
    color: white;
    border: none;
    border-radius: 20px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    z-index: 9999;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(4px);
  }
  .max-series-button:hover {
    background: rgba(83, 91, 242, 1);
    transform: scale(1.02);
  }
  .max-episode-add-button.in-queue {
    background: #4CAF50;
    border-color: #E8F5E9;
  }
  .max-episode-add-button.in-queue:hover {
    background: #388E3C;
  }
  .episode-progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .episode-progress-bar-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: #E50914;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .episode-thumbnail-container {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    margin-bottom: 8px;
  }

  .episode-thumbnail {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }
`;

export class UIManager {
  private static instance: UIManager;
  private elements: HTMLElement[] = [];
  private styleSheet: HTMLStyleElement | null = null;
  private readonly storage: StorageService;
  private cleanupFunctions: Array<() => void>;
  private readonly onAddEpisode: (episode: Element) => Promise<void>;

  private constructor(onAddEpisode: (episode: Element) => Promise<void>) {
    this.storage = StorageService.getInstance();
    this.cleanupFunctions = [];
    this.onAddEpisode = onAddEpisode;
    this.injectStyles();
  }

  public static getInstance(onAddEpisode?: (episode: Element) => Promise<void>): UIManager {
    if (!UIManager.instance) {
      if (!onAddEpisode) {
        throw new Error('UIManager must be initialized with onAddEpisode callback');
      }
      UIManager.instance = new UIManager(onAddEpisode);
    }
    return UIManager.instance;
  }

  private injectStyles(): void {
    if (!this.styleSheet) {
      this.styleSheet = document.createElement('style');
      this.styleSheet.textContent = STYLES;
      document.head.appendChild(this.styleSheet);
    }
  }

  private addCleanupFunction(fn: () => void): void {
    this.cleanupFunctions.push(fn);
  }

  public dispose() {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    
    // Also clean up any remaining elements
    this.elements.forEach(el => el.remove());
    this.elements = [];
    
    // Remove styles
    if (this.styleSheet) {
      this.styleSheet.remove();
      this.styleSheet = null;
    }
  }

  private addButtonListener(button: HTMLElement, handler: (e: MouseEvent) => void) {
    button.addEventListener('click', handler);
    this.addCleanupFunction(() => button.removeEventListener('click', handler));
  }

  public async createAddButton(item: QueueItem, container: HTMLElement, service?: string): Promise<void> {
    const button = document.createElement('button');
    const isMax = service === 'max';
    
    button.className = isMax ? 'max-episode-add-button' : 'universal-queue-add-button';
    
    // Check if item is already in queue
    const state = await this.storage.getQueueState();
    const isInQueue = state.items.some(i => i.id === item.id);
    
    if (isInQueue) {
      button.classList.add('in-queue');
      button.innerHTML = '✓';
      button.title = 'Already in Queue';
    } else {
      button.innerHTML = '+';
      button.title = 'Add to Universal Queue';
    }
    
    const clickHandler = async () => {
      if (isInQueue) {
        await this.storage.removeItem(item.id);
        button.classList.remove('in-queue');
        button.innerHTML = '+';
        button.title = 'Add to Universal Queue';
        this.showSuccess(button, 'Removed');
      } else {
        await this.storage.addItem(item);
        button.classList.add('in-queue');
        button.innerHTML = '✓';
        button.title = 'Already in Queue';
        this.showSuccess(button);
      }
    };

    this.addButtonListener(button, clickHandler);

    // Add progress bar if progress exists
    if (typeof item.progress === 'number') {
      const progressBar = document.createElement('div');
      progressBar.className = 'episode-progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'episode-progress-bar-fill';
      progressFill.style.width = `${item.progress * 100}%`;

      progressBar.appendChild(progressFill);
      container.appendChild(progressBar);
    }

    container.style.position = 'relative';
    container.appendChild(button);
    this.elements.push(button);
  }

  public async createSeriesButton(episodes: QueueItem[], service?: string): Promise<void> {
    const button = document.createElement('button');
    const isMax = service === 'max';
    
    button.className = isMax ? 'max-series-button' : 'universal-queue-series-button';
    
    // Filter out episodes already in queue
    const state = await this.storage.getQueueState();
    const newEpisodes = episodes.filter(episode => 
      !state.items.some(item => item.id === episode.id)
    );
    
    if (newEpisodes.length === 0) {
      button.innerHTML = '✓ All Episodes in Queue';
      button.style.background = '#4CAF50';
    } else {
      button.innerHTML = `Add ${newEpisodes.length} Episodes to Queue`;
    }
    
    const clickHandler = async () => {
      if (newEpisodes.length === 0) return;
      
      for (const episode of newEpisodes) {
        await this.storage.addItem(episode);
      }
      this.showSuccess(button, `✓ Added ${newEpisodes.length} Episodes`);
      
      // Update button state
      setTimeout(() => {
        button.innerHTML = '✓ All Episodes in Queue';
        button.style.background = '#4CAF50';
      }, 2000);
    };

    this.addButtonListener(button, clickHandler);
    document.body.appendChild(button);
    this.elements.push(button);
  }

  private showSuccess(element: HTMLElement, text?: string): void {
    const originalBackground = element.style.background;
    const originalContent = element.innerHTML;

    element.style.background = '#4CAF50';
    if (text) {
      element.innerHTML = text;
    } else {
      element.innerHTML = '✓';
    }

    setTimeout(() => {
      element.style.background = originalBackground;
      element.innerHTML = originalContent;
    }, 2000);
  }

  public cleanup(): void {
    this.cleanupFunctions.forEach((fn: () => void) => fn());
    this.cleanupFunctions = [];
  }

  public destroy(): void {
    this.cleanup();
    if (this.styleSheet) {
      this.styleSheet.remove();
      this.styleSheet = null;
    }
  }

  private getEpisodeSelectors(episodeNumber: number | undefined, episodeTitle?: string): string[] {
    const selectors = [];
    
    if (episodeNumber !== undefined) {
      // Max-specific selectors for numbered episodes
      selectors.push(
        `[class*="StyledTileWrapper-Fuse-Web-Play"]:has([class*="StyledTitleWrapperDefault"] span:contains("E${episodeNumber}:"))`,
        `[class*="StyledTileWrapper-Fuse-Web-Play"]:has([class*="StyledTitleWrapperDefault"] span:contains("Episode ${episodeNumber}"))`,
        `[class*="StyledTileWrapper"]:has([class*="StyledTitleWrapperDefault"] span:contains("E${episodeNumber}:"))`,
        `[class*="StyledTileWrapper"]:has([class*="StyledTitleWrapperDefault"] span:contains("Episode ${episodeNumber}"))`
      );
    }
    
    if (episodeTitle) {
      // Max-specific selectors for titles
      const escapedTitle = episodeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      selectors.push(
        `[class*="StyledTileWrapper-Fuse-Web-Play"]:has([class*="StyledTitleWrapperDefault"] span:contains("${escapedTitle}"))`,
        `[class*="StyledTileWrapper"]:has([class*="StyledTitleWrapperDefault"] span:contains("${escapedTitle}"))`
      );
    }
    
    // Fallback selectors for the episode container
    selectors.push(
      '[class*="StyledTileWrapper-Fuse-Web-Play"]',
      '[class*="StyledTileWrapper"]'
    );
    
    return selectors;
  }

  private async createEpisodeButton(episode: EpisodeItem): Promise<void> {
    console.log(`Content: Creating button for episode ${episode.episodeNumber}`);
    
    // Get selectors for this episode
    const selectors = this.getEpisodeSelectors(episode.episodeNumber, episode.title);
    console.log(`Content: Trying selectors for episode ${episode.episodeNumber}`, selectors);
    
    // Try each selector
    let targetElement: Element | null = null;
    for (const selector of selectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }
    
    if (!targetElement) {
      console.log(`Content: Could not find element for episode ${episode.episodeNumber} with selectors:`, selectors);
      return;
    }
    
    // Create a container for the button
    const container = document.createElement('div');
    container.className = 'max-episode-add-button-container';
    targetElement.appendChild(container);
    
    // Create and add the button
    await this.createAddButton(episode as QueueItem, container, 'max');
    console.log(`Content: Added button for episode ${episode.episodeNumber}`);
  }

  public async init(episodes: EpisodeItem[]): Promise<void> {
    console.log('Content: Creating series button with data:', {
      title: episodes[0]?.seriesTitle,
      episodeCount: episodes.length
    });
    
    // Create series button
    await this.createSeriesButton(episodes as QueueItem[], 'max');
    console.log('Content: Series button added to page');
    
    // Create episode buttons
    console.log('Content: Creating individual episode buttons');
    for (const episode of episodes) {
      await this.createEpisodeButton(episode);
    }
  }

  private createButtonContainer(episode: Element): HTMLElement {
    const container = document.createElement('div');
    container.className = 'uq-button-container';
    
    // Find the episode container (parent element that should hold the buttons)
    const episodeContainer = episode.closest('.StyledTileWrapper-Fuse-Web-Play__sc-1ramr47-31');
    if (!episodeContainer) {
      console.warn('Could not find episode container for button placement');
      return container;
    }

    // Check if container already exists
    const existingContainer = episodeContainer.querySelector('.uq-button-container');
    if (existingContainer) {
      return existingContainer as HTMLElement;
    }

    // Add container to episode
    episodeContainer.appendChild(container);
    return container;
  }

  private createButton(episode: Element, isInQueue: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `universal-queue-button episode-button${isInQueue ? ' added' : ''}`;
    button.textContent = isInQueue ? 'In Queue' : 'Add Episode';
    button.dataset.uqButton = `episode-${Date.now()}${Math.random().toString().slice(2)}`;

    // Get or create button container for this episode
    const container = this.createButtonContainer(episode);
    container.appendChild(button);

    return button;
  }

  async addEpisodeButton(episode: Element, isInQueue: boolean = false): Promise<HTMLButtonElement> {
    const button = this.createButton(episode, isInQueue);
    
    if (!isInQueue) {
      button.addEventListener('click', async () => {
        try {
          button.disabled = true;
          await this.onAddEpisode(episode);
          button.textContent = 'In Queue';
          button.classList.add('added');
        } catch (error) {
          console.error('Failed to add episode:', error);
          button.classList.add('error');
          button.textContent = 'Error';
        } finally {
          button.disabled = false;
        }
      });
    }

    return button;
  }
}