import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';
import './App.css';

function App() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const storage = StorageService.getInstance();

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const state = await storage.getQueueState();
    setItems(state.items);
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setItems(newItems);
    await storage.updateItemOrder(newItems);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: newUrl, // This will be updated by the extension
      type: 'movie', // This will be determined by the extension
      url: newUrl,
      service: 'other',
      addedAt: Date.now(),
      order: items.length
    };

    await storage.addItem(newItem);
    setItems([...items, newItem]);
    setNewUrl('');
  };

  return (
    <div className="app">
      <header>
        <h1>Universal Queue</h1>
      </header>

      <form onSubmit={handleAddItem} className="add-form">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="Paste a URL from Netflix, YouTube, etc."
          className="url-input"
        />
        <button type="submit" className="add-button">Add to Queue</button>
      </form>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="queue">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="queue-list"
            >
              {items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="queue-item"
                    >
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
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        Play
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className="universal-queue-powered-by">
        Powered by <a href="https://github.com/yourusername/universal-queue" target="_blank" rel="noopener noreferrer">Universal Queue</a>
      </div>
    </div>
  );
}

export default App; 