// Background session monitor - polls chrome.cookies API
// This is a standalone JS file that works alongside the service worker

console.log('Session monitor loaded');

// Poll for PHPSESSID cookie every 5 seconds
async function pollForSession() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.aula.dk',
      name: 'PHPSESSID'
    });

    if (cookie && cookie.value) {
      console.log('Session monitor found PHPSESSID:', cookie.value);

      // Save to storage
      await chrome.storage.local.set({
        currentSessionId: cookie.value,
        lastChecked: new Date().toISOString()
      });

      console.log('Session saved to storage');
    } else {
      console.log('Session monitor: PHPSESSID cookie not found');
    }
  } catch (error) {
    console.error('Error polling for session:', error);
  }
}

// Start polling immediately and then every 5 seconds
pollForSession();
const intervalId = setInterval(pollForSession, 5000);

// Export for cleanup if needed
self.sessionMonitorInterval = intervalId;

console.log('Session monitor: polling started (every 5 seconds)');
