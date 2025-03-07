import { ServiceConfig, StreamingServiceManager } from '@/common/types';
import { NavigationManager } from '../utils/navigation';
import { PageManager } from './page';

class ContentScript {
  private navigationManager: NavigationManager;
  private pageManager: PageManager;
  private serviceConfigs: Record<string, ServiceConfig>;

  constructor(configs: Record<string, ServiceConfig>) {
    this.navigationManager = NavigationManager.getInstance();
    this.pageManager = PageManager.getInstance();
    this.serviceConfigs = configs;

    this.setupNavigationHandling();
    this.initialize();
  }

  private setupNavigationHandling(): void {
    // Handle URL changes
    this.navigationManager.onUrlChange(() => {
      console.log('🔄 URL changed, reinitializing...');
      this.initialize();
    });

    // Register cleanup
    this.navigationManager.registerCleanup(() => {
      this.pageManager.cleanup();
    });
  }

  public async initialize(delay = 1000): Promise<void> {
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, delay));

    const url = window.location.href;
    const service = Object.entries(this.serviceConfigs).find(([domain]) => 
      url.includes(domain)
    );

    if (!service) {
      console.log('DEBUG: No service config found for this domain');
      return;
    }

    this.pageManager.setConfig(service[1]);
    await this.pageManager.initialize();
  }

  public destroy(): void {
    this.pageManager.destroy();
  }
}

// Initialize with service configs
declare global {
  interface Window {
    universalQueue: {
      scan: () => Promise<void>;
      debug: {
        runScanner: (delay?: number) => Promise<void>;
        serviceManager: StreamingServiceManager;
      };
    }
  }
}

// Import service configs from their respective files
import { NetflixService } from '../services/netflix';
import { YouTubeService } from '../services/youtube';
import { DisneyPlusService } from '../services/disneyplus';
import { PrimeVideoService } from '../services/primevideo';
import { MaxService } from '../services/max';
import { HuluService } from '../services/hulu';
import { AppleTVService } from '../services/appletv';

const serviceConfigs: Record<string, ServiceConfig> = {
  'netflix.com': new NetflixService().getConfig(),
  'youtube.com': new YouTubeService().getConfig(),
  'disneyplus.com': new DisneyPlusService().getConfig(),
  'primevideo.com': new PrimeVideoService().getConfig(),
  'max.com': new MaxService().getConfig(),
  'hulu.com': new HuluService().getConfig(),
  'tv.apple.com': new AppleTVService().getConfig()
};

// Initialize content script
window.universalQueue = {
  scan: (delay?: number) => new ContentScript(serviceConfigs).initialize(delay),
  debug: {
    runScanner: async (delay = 5000) => {
      console.log('Scanner functionality moved to service implementations');
      await new ContentScript(serviceConfigs).initialize(delay);
    },
    serviceManager: StreamingServiceManager.getInstance()
  }
}; 