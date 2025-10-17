// Content script that runs on aula.dk pages
// This script can access the page's cookies via document.cookie

(function() {
  'use strict';

  console.log('Aula Session Manager: Content script loaded on', window.location.href);

  // Extract PHPSESSID from document.cookie
  function extractPHPSESSID() {
    const cookies = document.cookie;
    const match = cookies.match(/PHPSESSID=([^;]+)/);

    if (match && match[1]) {
      const sessionId = match[1];
      console.log('Found PHPSESSID in document.cookie:', sessionId);
      return sessionId;
    }

    // Note: PHPSESSID is typically HttpOnly and won't be visible in document.cookie
    return null;
  }

  // Send session ID to background script
  function sendSessionToBackground(sessionId) {
    if (!sessionId) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SESSION_DETECTED',
      sessionId: sessionId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending session to background:', chrome.runtime.lastError);
      }
    });
  }

  // Check for session immediately
  const initialSessionId = extractPHPSESSID();
  if (initialSessionId) {
    sendSessionToBackground(initialSessionId);
  }

  // Monitor for cookie changes by checking periodically
  let lastSessionId = initialSessionId;

  setInterval(() => {
    const currentSessionId = extractPHPSESSID();

    if (currentSessionId && currentSessionId !== lastSessionId) {
      lastSessionId = currentSessionId;
      sendSessionToBackground(currentSessionId);
    }
  }, 2000); // Check every 2 seconds

  // Also check when the page regains focus (user comes back to tab)
  window.addEventListener('focus', () => {
    const currentSessionId = extractPHPSESSID();
    if (currentSessionId && currentSessionId !== lastSessionId) {
      lastSessionId = currentSessionId;
      sendSessionToBackground(currentSessionId);
    }
  });

  // Listen for requests from popup asking for current session
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_SESSION') {
      const sessionId = extractPHPSESSID();
      sendResponse({ sessionId: sessionId });
      return true;
    }
  });

  console.log('Aula Session Manager: Content script initialized');
})();
