import { QueueItem } from '@/common/types';
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
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(100, 108, 255, 0.9);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    z-index: 9999;
    transition: all 0.2s;
  }
  .max-episode-add-button:hover {
    background: rgba(83, 91, 242, 1);
    transform: scale(1.1);
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
  }
  .max-episode-add-button.in-queue:hover {
    background: #388E3C;
  }
`;

export class UIManager {
  private static instance: UIManager;
  private elements: HTMLElement[] = [];
  private styleSheet: HTMLStyleElement | null = null;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
    this.injectStyles();
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
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
    
    button.addEventListener('click', async () => {
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
    });

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
    
    button.addEventListener('click', async () => {
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
    });

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
    this.elements.forEach(element => {
      try {
        element.remove();
      } catch (error) {
        console.error('Error removing element:', error);
      }
    });
    this.elements = [];
  }

  public destroy(): void {
    this.cleanup();
    if (this.styleSheet) {
      this.styleSheet.remove();
      this.styleSheet = null;
    }
  }
} 