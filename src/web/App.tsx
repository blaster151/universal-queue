import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart, DragUpdate } from 'react-beautiful-dnd';
import { QueueItem, EpisodeItem } from '@/common/types';
import { StorageService } from '@/common/storage';
import './App.css';

const SERVICE_LOGOS: Record<string, string> = {
  netflix: 'https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/227_Netflix_logo-512.png',
  youtube: 'https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/395_Youtube_logo-512.png',
  disneyplus: 'https://cdn.icon-icons.com/icons2/2657/PNG/512/disney_plus_icon_161064.png',
  primevideo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/2560px-Amazon_Prime_Video_logo.svg.png',
  other: 'https://cdn-icons-png.flaticon.com/512/3875/3875172.png'
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
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
  const [isLoading, setIsLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const storage = StorageService.getInstance();

  useEffect(() => {
    loadQueue();

    // Listen for queue state updates
    const handleQueueStateUpdate = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === 'QUEUE_STATE_UPDATE' && event.data.state) {
        console.log('React: Received queue state update:', event.data.state);
        setItems(event.data.state.items);
      }
    };

    window.addEventListener('message', handleQueueStateUpdate);
    return () => window.removeEventListener('message', handleQueueStateUpdate);
  }, []);

  const loadQueue = async () => {
    try {
      const state = await storage.getQueueState();
      console.log('DND: Initial queue loaded:', state.items);
      setItems(state.items);
    } catch (error) {
      console.error('Error loading queue:', error);
    } finally {
      setIsLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: newUrl,
      type: 'movie',
      url: newUrl,
      service: 'other',
      thumbnailUrl: '',
      addedAt: Date.now(),
      order: items.length
    };

    await storage.addItem(newItem);
    setItems([...items, newItem]);
    setNewUrl('');
  };

  const handleClearQueue = async () => {
    if (window.confirm('Are you sure you want to clear the entire queue?')) {
      try {
        // Send message through web client content script
        window.postMessage({ type: 'REQUEST_CLEAR_QUEUE' }, window.location.origin);

        // Wait for response
        const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for clear queue response'));
          }, 5000);

          const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data.type === 'CLEAR_QUEUE_RESPONSE') {
              window.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(event.data);
            }
          };

          window.addEventListener('message', handler);
        });

        if (response.success) {
          setItems([]);
        } else {
          throw new Error(response.error || 'Failed to clear queue');
        }
      } catch (error) {
        console.error('Error clearing queue:', error);
        alert('Failed to clear queue. Please try again.');
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await storage.removeItem(itemId);
      setItems(items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error removing item:', error);
    }
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
          <div className="item-meta">
            <span className="service">{item.service}</span>
            {item.duration && <span className="duration">{formatDuration(item.duration)}</span>}
          </div>
        </div>
      </div>
    );
  };

  const totalDuration = items.reduce((total, item) => total + (item.duration || 0), 0);

  console.log('DND: Current items:', items);

  return (
    <div className="app">
      <header>
        <h1>Universal Queue</h1>
        {items.length > 0 && (
          <button 
            onClick={handleClearQueue}
            className="clear-queue-button"
          >
            Clear Queue
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="add-form">
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
              {isLoading ? (
                <div className="empty-state">Loading Contents...</div>
              ) : items.length === 0 ? (
                <div className="empty-state">No items in queue</div>
              ) : (
                <>
                  {items.map((item, index) => (
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
                          {renderQueueItem(item)}
                          <button
                            className="play-button"
                            onClick={() => window.open(item.url, '_blank')}
                          >
                            Play
                          </button>
                          <button
                            className="remove-button"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  <div className="queue-summary">
                    <p>Total Duration: {formatDuration(totalDuration)}</p>
                    <p>Items in Queue: {items.length}</p>
                  </div>
                </>
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