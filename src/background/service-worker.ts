import { MessageType, Message, MessageResponse } from '../types';
import { StorageService } from '../services/storage';
import { ApiService } from '../services/api';

// Listen for requests to aula.dk/api to extract PHPSESSID
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.requestHeaders) {
      // Find the Cookie header
      const cookieHeader = details.requestHeaders.find(
        header => header.name.toLowerCase() === 'cookie'
      );

      if (cookieHeader && cookieHeader.value) {
        // Extract PHPSESSID from cookie string
        const phpSessionMatch = cookieHeader.value.match(/PHPSESSID=([^;]+)/);

        if (phpSessionMatch && phpSessionMatch[1]) {
          const sessionId = phpSessionMatch[1];
          console.log('Captured PHPSESSID:', sessionId);

          // Save to storage (fire and forget - don't await in this listener)
          StorageService.saveCurrentSessionId(sessionId).then(async () => {
            // Check if auto-update is enabled
            const config = await StorageService.getConfig();
            if (config.autoUpdate && config.retrieveEndpoint && config.saveEndpoint) {
              await checkAndUpdateSession(sessionId, config.retrieveEndpoint, config.saveEndpoint);
            }
          }).catch(error => {
            console.error('Error processing session:', error);
          });
        }
      }
    }
  },
  { urls: ['*://*.aula.dk/api/*'] },
  ['requestHeaders']
);

// Also try to get PHPSESSID directly from cookies API
async function getSessionIdFromCookies(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.aula.dk',
      name: 'PHPSESSID'
    });
    return cookie?.value || null;
  } catch (error) {
    console.error('Error getting cookie:', error);
    return null;
  }
}

// Auto-update logic: compare current session with stored session
async function checkAndUpdateSession(
  currentSessionId: string,
  retrieveEndpoint: string,
  saveEndpoint: string
): Promise<void> {
  try {
    // Get stored session from backend
    const storedSession = await ApiService.getStoredSession(retrieveEndpoint);

    // Cache it locally
    await StorageService.saveStoredSession(storedSession);

    // Compare with current session
    if (storedSession.sessionId !== currentSessionId) {
      console.log('Session IDs differ, updating backend...');
      const updatedSession = await ApiService.saveSession(saveEndpoint, currentSessionId);
      await StorageService.saveStoredSession(updatedSession);
      console.log('Backend updated with new session ID');
    }
  } catch (error) {
    console.error('Error in auto-update:', error);
  }
}

// Handle messages from popup, options pages, and content scripts
chrome.runtime.onMessage.addListener(
  (message: any, _sender, sendResponse) => {
    // Handle SESSION_DETECTED message from content script
    if (message.type === 'SESSION_DETECTED' && message.sessionId) {
      console.log('Received session from content script:', message.sessionId);

      StorageService.saveCurrentSessionId(message.sessionId).then(async () => {
        // Check if auto-update is enabled
        const config = await StorageService.getConfig();
        if (config.autoUpdate && config.retrieveEndpoint && config.saveEndpoint) {
          await checkAndUpdateSession(message.sessionId, config.retrieveEndpoint, config.saveEndpoint);
        }
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error saving session from content script:', error);
        sendResponse({ success: false, error: error.message });
      });

      return true; // Async response
    }

    // Handle other messages (from popup/options)
    handleMessage(message as Message)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(message: Message): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case MessageType.GET_CURRENT_SESSION: {
        // Try to get from cookies first, fallback to storage
        let sessionId = await getSessionIdFromCookies();
        if (!sessionId) {
          sessionId = await StorageService.getCurrentSessionId();
        }
        return {
          success: true,
          data: { sessionId }
        };
      }

      case MessageType.GET_STORED_SESSION: {
        const config = await StorageService.getConfig();
        if (!config.retrieveEndpoint) {
          throw new Error('Retrieve endpoint not configured');
        }

        const storedSession = await ApiService.getStoredSession(config.retrieveEndpoint);
        await StorageService.saveStoredSession(storedSession);

        return {
          success: true,
          data: storedSession
        };
      }

      case MessageType.SAVE_SESSION: {
        const config = await StorageService.getConfig();
        if (!config.saveEndpoint) {
          throw new Error('Save endpoint not configured');
        }

        const { sessionId } = message.payload;
        if (!sessionId) {
          throw new Error('Session ID is required');
        }

        const savedSession = await ApiService.saveSession(config.saveEndpoint, sessionId);
        await StorageService.saveStoredSession(savedSession);

        return {
          success: true,
          data: savedSession
        };
      }

      case MessageType.GET_CONFIG: {
        const config = await StorageService.getConfig();
        return {
          success: true,
          data: config
        };
      }

      case MessageType.UPDATE_CONFIG: {
        await StorageService.saveConfig(message.payload);
        return {
          success: true
        };
      }

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    throw error;
  }
}

// Poll for PHPSESSID using chrome.cookies API
// This runs every 5 seconds to detect the session even if HttpOnly
async function pollForSession() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.aula.dk',
      name: 'PHPSESSID'
    });

    if (cookie && cookie.value) {
      console.log('Session poll found PHPSESSID:', cookie.value);
      await StorageService.saveCurrentSessionId(cookie.value);

      // Check if auto-update is enabled
      const config = await StorageService.getConfig();
      if (config.autoUpdate && config.retrieveEndpoint && config.saveEndpoint) {
        await checkAndUpdateSession(cookie.value, config.retrieveEndpoint, config.saveEndpoint);
      }
    }
  } catch (error) {
    console.error('Error polling for session:', error);
  }
}

// Start polling immediately and then every 5 seconds
pollForSession();
setInterval(pollForSession, 5000);

// Initialize extension
console.log('Aula Login Session Manager: Background service worker loaded');
console.log('Session polling started (every 5 seconds)');
