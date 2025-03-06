import { ServiceConfig, QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';

const serviceConfigs: Record<string, ServiceConfig> = {
  'netflix.com': {
    name: 'netflix',
    urlPattern: 'netflix.com/browse/*',
    titleSelector: '.title-card-title',
    thumbnailSelector: '.title-card-image',
    completionDetector: {
      type: 'time',
      value: 'video.currentTime >= video.duration - 0.5'
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
`;
document.head.appendChild(style);

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

// Function to extract item details from the page
function extractItemDetails(config: ServiceConfig): QueueItem | null {
  const titleElement = document.querySelector(config.titleSelector);
  const thumbnailElement = document.querySelector(config.thumbnailSelector) as HTMLImageElement;
  
  if (!titleElement) return null;

  const title = titleElement.textContent?.trim() || '';
  const thumbnailUrl = thumbnailElement?.src || '';
  const url = window.location.href;

  return {
    id: Date.now().toString(),
    title,
    type: 'movie', // This could be enhanced to detect episodes
    url,
    service: config.name,
    thumbnailUrl,
    addedAt: Date.now(),
    order: 0 // This will be updated by the storage service
  };
}

// Function to add buttons to video elements
function addButtonsToVideos() {
  const url = window.location.href;
  const service = Object.entries(serviceConfigs).find(([domain]) => 
    url.includes(domain)
  );

  if (!service) return;

  const config = service[1];
  const videoElements = document.querySelectorAll('video');
  
  videoElements.forEach(video => {
    const container = video.parentElement;
    if (!container) return;

    const item = extractItemDetails(config);
    if (!item) return;

    const button = createAddButton(item);
    container.style.position = 'relative';
    container.appendChild(button);
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