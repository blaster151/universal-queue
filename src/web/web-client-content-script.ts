// Content script for web app to receive messages from extension
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  console.log('Web Client: Received message from extension:', message);
  
  // Forward state updates to web app
  if (message.type === 'QUEUE_STATE_UPDATE' || message.type === 'QUEUE_UPDATED') {
    window.postMessage(message, window.location.origin);
  }
});

// Listen for messages from the web app
window.addEventListener('message', async (event) => {
  // Verify origin for security
  if (event.origin !== window.location.origin) return;

  if (event.data.type === 'REQUEST_QUEUE_STATE') {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_QUEUE_STATE' });
      window.postMessage({
        type: 'QUEUE_STATE_UPDATE',
        state: response.state
      }, window.location.origin);
    } catch (error) {
      console.error('Web Client: Error getting queue state:', error);
    }
  } else if (event.data.type === 'REQUEST_CLEAR_QUEUE') {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' });
      window.postMessage({
        type: 'CLEAR_QUEUE_RESPONSE',
        success: response.success,
        error: response.error
      }, window.location.origin);
    } catch (error) {
      console.error('Web Client: Error clearing queue:', error);
      window.postMessage({
        type: 'CLEAR_QUEUE_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, window.location.origin);
    }
  }
}); 