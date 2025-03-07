import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart, DragUpdate } from 'react-beautiful-dnd';
import { QueueItem } from '@/common/types';
import { StorageService } from '@/common/storage';
import './App.css';

const SERVICE_LOGOS: Record<string, string> = {
  netflix: 'https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/227_Netflix_logo-512.png',
  youtube: 'https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/395_Youtube_logo-512.png',
  disneyplus: 'https://cdn.icon-icons.com/icons2/2657/PNG/512/disney_plus_icon_161064.png',
  primevideo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/2560px-Amazon_Prime_Video_logo.svg.png',
  other: 'https://cdn-icons-png.flaticon.com/512/3875/3875172.png'
};

const getListStyle = (isDraggingOver: boolean) => ({
  background: isDraggingOver ? '#e9ecef' : '#f8f9fa',
  padding: '1rem',
  minHeight: '100px',
  borderRadius: '8px',
  border: '2px dashed ' + (isDraggingOver ? '#646cff' : '#ccc'),
});

const getItemStyle = (isDragging: boolean, draggableStyle: any) => ({
  userSelect: 'none',
  background: isDragging ? '#f8f9fa' : '#fff',
  boxShadow: isDragging ? '0 8px 16px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
  transform: isDragging ? 'scale(1.02)' : 'none',
  ...draggableStyle,
});

function App() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const storage = StorageService.getInstance();

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const state = await storage.getQueueState();
    console.log('DND: Initial queue loaded:', state.items);
    setItems(state.items);
  };

  const handleDragStart = (start: DragStart) => {
    console.log('DND: Drag started:', {
      draggableId: start.draggableId,
      source: start.source,
      type: start.type,
    });
  };

  const handleDragUpdate = (update: DragUpdate) => {
    console.log('DND: Drag updated:', {
      draggableId: update.draggableId,
      source: update.source,
      destination: update.destination,
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    console.log('DND: Drag ended:', {
      draggableId: result.draggableId,
      source: result.source,
      destination: result.destination,
      type: result.type,
    });

    if (!result.destination) {
      console.log('DND: No destination, returning');
      return;
    }

    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    console.log('DND: New order:', newItems.map(item => ({
      id: item.id,
      title: item.title,
      index: newItems.indexOf(item)
    })));

    setItems(newItems);
    try {
      await storage.updateItemOrder(newItems);
      console.log('DND: Order updated in storage');
    } catch (error) {
      console.error('DND: Error updating order:', error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: newUrl,
      type: 'movie',
      url: newUrl,
      service: 'other',
      addedAt: Date.now(),
      order: items.length
    };

    await storage.addItem(newItem);
    setItems([...items, newItem]);
    setNewUrl('');
  };

  console.log('DND: Current items:', items);

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

      <DragDropContext 
        onDragStart={handleDragStart}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
      >
        <Droppable droppableId="queue" type="QUEUE_ITEM">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
              className="queue-list"
            >
              {items.length === 0 ? (
                <div className="empty-state">No items in queue</div>
              ) : (
                items.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={getItemStyle(
                          snapshot.isDragging,
                          provided.draggableProps.style
                        )}
                        className="queue-item"
                      >
                        <div 
                          className="drag-handle"
                          {...provided.dragHandleProps}
                        >
                          ⋮⋮
                        </div>
                        <img
                          src={SERVICE_LOGOS[item.service] || SERVICE_LOGOS.other}
                          alt={item.service}
                          className="service-logo"
                        />
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
                ))
              )}
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