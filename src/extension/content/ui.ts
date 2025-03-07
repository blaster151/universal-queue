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
`;

export class UIManager {
  private static instance: UIManager;
  private elements: HTMLElement[] = [];
  private styleSheet: HTMLStyleElement | null = null;

  private constructor() {
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

  public createAddButton(item: QueueItem, container: HTMLElement): void {
    const button = document.createElement('button');
    button.className = 'universal-queue-add-button';
    button.innerHTML = '+';
    button.title = 'Add to Universal Queue';
    
    button.addEventListener('click', async () => {
      const storage = StorageService.getInstance();
      await storage.addItem(item);
      this.showSuccess(button);
    });

    container.style.position = 'relative';
    container.appendChild(button);
    this.elements.push(button);
  }

  public createSeriesButton(episodes: QueueItem[]): void {
    const button = document.createElement('button');
    button.className = 'universal-queue-series-button';
    button.innerHTML = `Add ${episodes.length} Unwatched Episodes to Queue`;
    button.title = 'Add all unwatched episodes to Universal Queue';
    
    button.addEventListener('click', async () => {
      const storage = StorageService.getInstance();
      for (const episode of episodes) {
        await storage.addItem(episode);
      }
      this.showSuccess(button, `✓ Added ${episodes.length} Episodes to Queue`);
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