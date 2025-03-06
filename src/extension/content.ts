import { ServiceConfig, QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';

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

// Function to add buttons to video elements
async function addButtonsToVideos() {
  const url = window.location.href;
  const service = Object.entries(serviceConfigs).find(([domain]) => 
    url.includes(domain)
  );

  if (!service) return;

  const config = service[1];
  const items = await extractItemDetails(config);
  
  if (!items) return;

  // Handle both single items and arrays of items (for series)
  const itemsArray = Array.isArray(items) ? items : [items];
  
  // If this is a series, add the series-wide button
  if (config.isSeries && config.isSeries()) {
    const seriesButton = createSeriesButton(itemsArray);
    document.body.appendChild(seriesButton);
  }
  
  // Add individual episode buttons
  itemsArray.forEach(item => {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      const container = video.parentElement;
      if (!container) return;

      const button = createAddButton(item);
      container.style.position = 'relative';
      container.appendChild(button);
    });
  });
}

// Initial run
addButtonsToVideos();

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      addButtonsToVideos();
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
}); 