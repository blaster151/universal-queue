export class NavigationManager {
  private static instance: NavigationManager;
  private currentUrl: string;
  private cleanupCallbacks: (() => void)[] = [];
  private urlChangeCallbacks: ((newUrl: string) => void)[] = [];

  private constructor() {
    this.currentUrl = window.location.href;
    this.setupHistoryListener();
    this.setupUrlObserver();
  }

  public static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }

  private setupHistoryListener() {
    // Listen for pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleUrlChange();
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.handleUrlChange();
    });
  }

  private setupUrlObserver() {
    // Some SPAs might modify the URL without using History API
    const observer = new MutationObserver(() => {
      if (window.location.href !== this.currentUrl) {
        this.handleUrlChange();
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
  }

  private handleUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== this.currentUrl) {
      console.log('URL changed:', this.currentUrl, '->', newUrl);
      
      // Run cleanup callbacks
      this.cleanup();
      
      // Update current URL
      this.currentUrl = newUrl;
      
      // Notify URL change listeners
      this.urlChangeCallbacks.forEach(callback => callback(newUrl));
    }
  }

  public onUrlChange(callback: (newUrl: string) => void): () => void {
    this.urlChangeCallbacks.push(callback);
    return () => {
      this.urlChangeCallbacks = this.urlChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  public registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  public cleanup(): void {
    // Run all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });
    
    // Clear the callbacks array
    this.cleanupCallbacks = [];
  }
} 