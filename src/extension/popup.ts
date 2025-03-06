import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';

const queueList = document.getElementById('queue-list');
const storage = StorageService.getInstance();

async function loadQueue() {
  const state = await storage.getQueueState();
  renderQueue(state.items);
}

function renderQueue(items: QueueItem[]) {
  if (!queueList) return;

  if (items.length === 0) {
    queueList.innerHTML = `
      <div class="empty-state">
        Your queue is empty. Add items from streaming services or the web app.
      </div>
    `;
    return;
  }

  const dragDropContext = document.createElement('div');
  dragDropContext.innerHTML = `
    <div class="queue-list">
      ${items.map((item, index) => `
        <div class="queue-item" data-index="${index}">
          ${item.thumbnailUrl ? `
            <img src="${item.thumbnailUrl}" alt="${item.title}" class="thumbnail">
          ` : ''}
          <div class="item-info">
            <h3>${item.title}</h3>
            <p class="service">${item.service}</p>
            ${item.type === 'episode' ? `
              <p class="episode-info">S${item.seasonNumber}E${item.episodeNumber}</p>
            ` : ''}
          </div>
          <button class="play-button" data-url="${item.url}">Play</button>
        </div>
      `).join('')}
    </div>
  `;
  queueList.innerHTML = '';
  queueList.appendChild(dragDropContext);

  // Add event listeners
  const playButtons = queueList.querySelectorAll('.play-button');
  playButtons.forEach(button => {
    button.addEventListener('click', () => {
      const url = button.getAttribute('data-url');
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });

  // Add drag and drop functionality
  let draggedItem: HTMLElement | null = null;
  const queueItems = queueList.querySelectorAll('.queue-item');

  queueItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item as HTMLElement;
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem) return;

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = (e as DragEvent).clientY < midY ? 'before' : 'after';

      if (position === 'before') {
        queueList.insertBefore(draggedItem, item);
      } else {
        queueList.insertBefore(draggedItem, item.nextSibling);
      }
    });
  });

  // Save new order when drag ends
  queueList.addEventListener('dragend', async () => {
    const newItems = Array.from(queueList.querySelectorAll('.queue-item')).map((item, index) => {
      const originalIndex = parseInt(item.getAttribute('data-index') || '0');
      return items[originalIndex];
    });

    await storage.updateItemOrder(newItems);
  });
}

// Initial load
loadQueue(); 