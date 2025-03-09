// Content script for web app to receive messages from extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'QUEUE_STATE_UPDATE') {
    console.log('Web content script: Received queue state update');
    // Forward the message to the web app
    window.postMessage({
      type: 'QUEUE_STATE_UPDATE',
      state: message.state
    }, window.location.origin);
    sendResponse({ success: true });
  }
  return true;
});

// Listen for requests from the web app
window.addEventListener('message', async (event) => {
  // Verify origin for security
  if (event.origin !== window.location.origin) return;

  if (event.data.type === 'REQUEST_QUEUE_STATE') {
    console.log('Web content script: Received request for queue state');
    try {
      // Request state from extension's storage
      const result = await chrome.storage.local.get('universal_queue_state');
      const state = result['universal_queue_state'] || { items: [], lastUpdated: Date.now() };
      
      // Send it back to the web app
      window.postMessage({
        type: 'QUEUE_STATE_UPDATE',
        state
      }, window.location.origin);
    } catch (error) {
      console.error('Web content script: Error getting queue state:', error);
    }
  }
}); 