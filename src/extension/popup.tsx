import { QueueItem, EpisodeItem } from '@/common/types';
import { StorageService } from '@/common/storage';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DropResult } from 'react-beautiful-dnd';
import React from 'react';
import ReactDOM from 'react-dom';

const storage = StorageService.getInstance();

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

  const handleRemoveItem = async (id: string) => {
    const newItems = items.filter((item) => item.id !== id);
    setItems(newItems);
    await storage.updateItemOrder(newItems);
  };

  const renderQueueItem = (item: QueueItem) => {
    const isEpisode = item.type === 'episode';
    const episodeItem = isEpisode ? item as EpisodeItem : null;

    return (
      <div className="queue-item" key={item.id}>
        {item.thumbnailUrl && (
          <img src={item.thumbnailUrl} alt={item.title} className="thumbnail" />
        )}
        <div className="item-info">
          <h3>{item.title}</h3>
          {episodeItem && (
            <p className="episode-info">
              {episodeItem.seriesTitle} - S{episodeItem.seasonNumber}E{episodeItem.episodeNumber}
            </p>
          )}
          <p className="service">{item.service}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="queue-container">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="queue">
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
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
                        {renderQueueItem(item)}
                        <button
                          className="remove-button"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove from queue"
                        >
                          ×
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
    </div>
  );
}

// Initialize React app
const root = document.getElementById('queue-list');
if (root) {
  ReactDOM.render(<QueueApp />, root);
} 