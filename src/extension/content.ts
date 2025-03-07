import { ServiceConfig, QueueItem, StreamingServiceManager } from '@/common/types';
import { StorageService } from '@/common/storage';
import { StreamingServiceScanner } from './scanner';
import { NavigationManager } from './utils/navigation';

// Add debug utilities to window object
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

// Debug mode - set to true to enable scanner
const DEBUG_MODE = true;

const serviceConfigs: Record<string, ServiceConfig> = {
  'netflix.com': {
    name: 'netflix',
    urlPattern: 'netflix.com/*',
    titleSelector: '.watch-title, .title-title, .title-card-title, .title-info h1',
    thumbnailSelector: '.watch-thumbnail, .title-card-image, .title-info img',
    durationSelector: '.watch-duration',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    },
    isSeries: () => {
      // Check if we're on a series page by looking for episode list or season list
      return !!document.querySelector('.episode-list, .season-list, .episodes-container, .episode-item');
    },
    getSeriesData: async () => {
      // Get all episode elements
      const episodeElements = document.querySelectorAll('.episode-item, .title-card, .episode-item-container');
      const episodes: QueueItem[] = [];

      for (const element of episodeElements) {
        // Check if episode is watched (red progress bar)
        const progressBar = element.querySelector('.progress-bar, .episode-progress');
        const isWatched = progressBar?.getAttribute('style')?.includes('background-color: rgb(229, 9, 20)');
        
        if (isWatched) continue;

        const titleElement = element.querySelector('.title-card-title, .episode-title, .episode-item-title');
        const thumbnailElement = element.querySelector('.title-card-image, .episode-thumbnail, .episode-item-image') as HTMLImageElement;
        const url = element.querySelector('a')?.href || '';

        if (titleElement && url) {
          episodes.push({
            id: Date.now().toString() + Math.random(),
            title: titleElement.textContent?.trim() || '',
            type: 'episode',
            url,
            service: 'netflix',
            thumbnailUrl: thumbnailElement?.src || '',
            addedAt: Date.now(),
            order: 0
          });
        }
      }

      return episodes;
    }
  },
  'youtube.com': {
    name: 'youtube',
    urlPattern: 'youtube.com/*',
    titleSelector: '#video-title',
    thumbnailSelector: '#thumbnail',
    completionDetector: {
      type: 'event',
      value: 'video.ended'
    },
    isSeries: () => {
      // Check if we're on a playlist page
      return !!document.querySelector('.playlist-items, #playlist-items');
    },
    getSeriesData: async () => {
      // Get all video elements in the playlist
      const videoElements = document.querySelectorAll('.playlist-items .ytd-playlist-video-renderer, #playlist-items .ytd-playlist-video-renderer');
      const episodes: QueueItem[] = [];

      for (const element of videoElements) {
        const titleElement = element.querySelector('#video-title');
        const thumbnailElement = element.querySelector('#thumbnail img') as HTMLImageElement;
        const url = titleElement?.getAttribute('href') || '';

        if (titleElement && url) {
          episodes.push({
            id: Date.now().toString() + Math.random(),
            title: titleElement.textContent?.trim() || '',
            type: 'episode',
            url: url.startsWith('http') ? url : `https://www.youtube.com${url}`,
            service: 'youtube',
            thumbnailUrl: thumbnailElement?.src || '',
            addedAt: Date.now(),
            order: 0
          });
        }
      }

      return episodes;
    }
  },
  'disneyplus.com': {
    name: 'disneyplus',
    urlPattern: 'disneyplus.com/*',
    titleSelector: '.title-card-title',
    thumbnailSelector: '.title-card-image',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    }
  },
  'primevideo.com': {
    name: 'primevideo',
    urlPattern: 'primevideo.com/*',
    titleSelector: '.title-card-title',
    thumbnailSelector: '.title-card-image',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
    }
  }
};

// Create and inject the add button styles
const style = document.createElement('style');
style.textContent = `
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
  .universal-queue-powered-by {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.3s;
  }
  .universal-queue-powered-by:hover {
    opacity: 0.8;
  }
  .universal-queue-powered-by a {
    color: #646cff;
    text-decoration: none;
  }
  .universal-queue-powered-by a:hover {
    text-decoration: underline;
  }
`;
document.head.appendChild(style);

// Create and inject the powered by message
const poweredBy = document.createElement('div');
poweredBy.className = 'universal-queue-powered-by';
poweredBy.innerHTML = 'Powered by <a href="https://github.com/yourusername/universal-queue" target="_blank">Universal Queue</a>';
document.body.appendChild(poweredBy);

// Track our added UI elements for cleanup
const uiElements: HTMLElement[] = [];

// Function to clean up UI elements
function cleanupUI() {
  uiElements.forEach(element => {
    try {
      element.remove();
    } catch (error) {
      console.error('Error removing element:', error);
    }
  });
  uiElements.length = 0;
}

// Function to create an add button
function createAddButton(item: QueueItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'universal-queue-add-button';
  button.innerHTML = '+';
  button.title = 'Add to Universal Queue';
  
  button.addEventListener('click', async () => {
    const storage = StorageService.getInstance();
    await storage.addItem(item);
    button.style.background = '#4CAF50';
    button.innerHTML = '✓';
    setTimeout(() => {
      button.style.background = '#646cff';
      button.innerHTML = '+';
    }, 2000);
  });

  uiElements.push(button);
  return button;
}

// Function to create a series add button
function createSeriesButton(episodes: QueueItem[]): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'universal-queue-series-button';
  button.innerHTML = `Add ${episodes.length} Unwatched Episodes to Queue`;
  button.title = 'Add all unwatched episodes to Universal Queue';
  
  button.addEventListener('click', async () => {
    const storage = StorageService.getInstance();
    for (const episode of episodes) {
      await storage.addItem(episode);
    }
    button.style.background = '#4CAF50';
    button.innerHTML = '✓ Added to Queue';
    setTimeout(() => {
      button.style.background = '#646cff';
      button.innerHTML = `Add ${episodes.length} Unwatched Episodes to Queue`;
    }, 2000);
  });

  uiElements.push(button);
  return button;
}

// Function to extract item details from the page
async function extractItemDetails(config: ServiceConfig): Promise<QueueItem | QueueItem[] | null> {
  // Check if this is a series
  if (config.isSeries && config.isSeries()) {
    return config.getSeriesData?.() || null;
  }

  const titleElement = document.querySelector(config.titleSelector) as HTMLElement;
  const thumbnailElement = config.thumbnailSelector ? 
    document.querySelector(config.thumbnailSelector) as HTMLImageElement : 
    null;
  
  if (!titleElement) return null;

  const title = titleElement.textContent?.trim() || '';
  const thumbnailUrl = thumbnailElement?.src || '';
  let url = window.location.href;

  // For Netflix, ensure we're using the watch URL format
  if (config.name === 'netflix') {
    // Extract title ID from various URL formats
    const titleId = url.match(/jbv=(\d+)/)?.[1] || // Browse URL
                   url.match(/title\/(\d+)/)?.[1] || // Title URL
                   url.match(/watch\/(\d+)/)?.[1];   // Watch URL
    
    if (titleId) {
      // Convert to watch URL format
      url = `https://www.netflix.com/watch/${titleId}`;
    }
  }

  return {
    id: Date.now().toString(),
    title,
    type: 'movie',
    url,
    service: config.name,
    thumbnailUrl,
    addedAt: Date.now(),
    order: 0
  };
}

// Function to run the scanner in debug mode
async function runScanner(delay = 5000) {
  console.log(`🕒 Waiting ${delay}ms for content to load...`);
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Get page context
  const hasVideo = document.querySelector('video') !== null;
  const url = window.location.href;
  const domain = window.location.hostname.replace(/^www\./, '');
  
  console.log('\n🔍 Universal Queue Scanner');
  console.log('=======================');
  console.log('URL:', url);
  console.log('Context:', hasVideo ? '📺 Has Video Player' : '🔎 No Video Player');
  
  const scanner = new StreamingServiceScanner();
  const result = await scanner.scan();
  
  // Print a clear summary
  console.log('\n📊 Page Analysis:');
  console.log('--------------');
  
  // Page Type Detection
  const pageTypes = [];
  if (hasVideo) pageTypes.push('Video Player');
  if (result.isSeriesList) pageTypes.push('Series/List');
  if (result.possibleTitleSelectors.length > 0) pageTypes.push('Has Title');
  console.log('Type:', pageTypes.join(', ') || 'Unknown');
  
  // Only show title matches if they seem relevant
  if (result.possibleTitleSelectors.length > 0) {
    const relevantTitles = result.possibleTitleSelectors.filter(match => 
      // Filter out likely irrelevant matches
      match.sampleValues.some(value => value.length > 5) && // Reasonable length
      !match.sampleValues.some(value => value.includes('http')) // Not URLs
    );
    
    if (relevantTitles.length > 0) {
      console.log('\n📝 Detected Titles:');
      relevantTitles.forEach(match => {
        console.log(`  "${match.sampleValues[0]}"${match.sampleValues.length > 1 ? ' (+ more)' : ''}`);
        console.log(`   via: ${match.selector}`);
      });
    }
  }

  // Only show thumbnails if they seem valid
  if (result.possibleThumbnailSelectors.length > 0) {
    const relevantThumbnails = result.possibleThumbnailSelectors.filter(match =>
      match.sampleValues.some(value => value.includes('http'))
    );
    
    if (relevantThumbnails.length > 0) {
      console.log('\n🖼️ Detected Images:');
      console.log(`  Found ${relevantThumbnails.reduce((sum, m) => sum + m.matches, 0)} possible thumbnails`);
      console.log('  Top matches:');
      relevantThumbnails.slice(0, 2).forEach(match => {
        console.log(`   via: ${match.selector} (${match.matches} found)`);
      });
    }
  }

  // Series-specific info
  if (result.isSeriesList && result.episodeData) {
    console.log('\n📺 Series Content:');
    console.log(`  Episodes: ${result.episodeData.count}`);
    if (result.episodeData.seasonSelectors.length > 0) {
      const seasonExamples = result.episodeData.seasonSelectors[0].sampleValues;
      console.log(`  Seasons: ${seasonExamples.slice(0, 3).join(', ')}${seasonExamples.length > 3 ? '...' : ''}`);
    }
  }

  // Compare with existing config if available
  const existingConfig = serviceConfigs[domain];
  if (existingConfig) {
    console.log('\n🔄 Config Check:');
    const suggestedConfig = StreamingServiceScanner.generateConfig(result);
    
    // Only show if there's a meaningful difference
    const currentTitleMatches = document.querySelectorAll(existingConfig.titleSelector).length;
    const suggestedTitleMatches = suggestedConfig.titleSelector ? 
      document.querySelectorAll(suggestedConfig.titleSelector).length : 0;
    
    if (currentTitleMatches !== suggestedTitleMatches) {
      console.log('  Title Selector Difference:');
      console.log(`   Current: ${currentTitleMatches} matches`);
      console.log(`   Suggested: ${suggestedTitleMatches} matches`);
    }
  }

  console.log('\n✨ Scan Complete\n');
}

// Main initialization with debouncing
let initTimeout: number | null = null;
async function init(delay = 1000) {
  if (initTimeout) {
    window.clearTimeout(initTimeout);
  }

  initTimeout = window.setTimeout(async () => {
    const url = window.location.href;
    const service = Object.entries(serviceConfigs).find(([domain]) => 
      url.includes(domain)
    );

    if (!service) {
      console.log('DEBUG: No service config found for this domain');
      return;
    }

    // Clean up existing UI elements before adding new ones
    cleanupUI();

    const config = service[1];
    const items = await extractItemDetails(config);
    
    if (!items) {
      console.log('DEBUG: No items found on page');
      return;
    }

    // Handle both single items and arrays of items (for series)
    const itemsArray = Array.isArray(items) ? items : [items];
    
    // If this is a series, add the series-wide button
    if (config.isSeries && config.isSeries()) {
      console.log('DEBUG: Series detected, adding series button');
      const seriesButton = createSeriesButton(itemsArray);
      document.body.appendChild(seriesButton);
    }
    
    // Add individual episode buttons
    itemsArray.forEach(item => {
      console.log('DEBUG: Adding button for item:', item);
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        const container = video.parentElement;
        if (!container) return;

        const button = createAddButton(item);
        container.style.position = 'relative';
        container.appendChild(button);
      });
    });
  }, delay);
}

// Initialize navigation manager and set up URL change handling
const navigationManager = NavigationManager.getInstance();
navigationManager.onUrlChange((newUrl) => {
  console.log('🔄 URL changed, reinitializing...', newUrl);
  init();
});

// Register cleanup with navigation manager
navigationManager.registerCleanup(cleanupUI);

// Make debug utilities available
window.universalQueue = {
  scan: (delay?: number) => init(delay),
  debug: {
    runScanner,
    serviceManager: StreamingServiceManager.getInstance()
  }
};

// Initial setup
init(); 