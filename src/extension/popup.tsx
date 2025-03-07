import { QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DropResult } from 'react-beautiful-dnd';
import React from 'react';
import ReactDOM from 'react-dom';

const storage = StorageService.getInstance();

const COMMON_EPISODE_PATTERNS = {
  // Add role-based patterns
  container: [
    '[role="button"][aria-label*="Episode"]',
    '[role="listitem"][aria-label*="Episode"]',
    // Keep existing patterns too
    '[class*="episode"]'
  ]
};

function QueueApp() {
  const [items, setItems] = React.useState<QueueItem[]>([]);

  React.useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    const state = await storage.getQueueState();
    setItems(state.items);
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setItems(newItems);
    await storage.updateItemOrder(newItems);
  };

  const handlePlay = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="queue">
        {(provided: DroppableProvided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="queue-list"
          >
            {items.length === 0 ? (
              <div className="empty-state">
                Your queue is empty. Add items from streaming services or the web app.
              </div>
            ) : (
              items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided: DraggableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="queue-item"
                    >
                      <div className="drag-handle">⋮⋮</div>
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="thumbnail"
                        />
                      )}
                      <div className="item-info">
                        <h3>{item.title}</h3>
                        <p className="service">{item.service}</p>
                        {item.type === 'episode' && (
                          <p className="episode-info">
                            S{item.seasonNumber}E{item.episodeNumber}
                          </p>
                        )}
                      </div>
                      <button
                        className="play-button"
                        onClick={() => handlePlay(item.url)}
                      >
                        Play
                      </button>
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

// Initialize React app
const root = document.getElementById('queue-list');
if (root) {
  ReactDOM.render(<QueueApp />, root);
} 