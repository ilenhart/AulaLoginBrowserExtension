// Aula Session Manager - Background Service Worker (Standalone, no modules)
// This file has NO imports and works as a standalone script

console.log('=== Aula Login Session Manager: Service Worker Starting ===');

// MessageType enum (inline)
const MessageType = {
  GET_CURRENT_SESSION: 'GET_CURRENT_SESSION',
  GET_STORED_SESSION: 'GET_STORED_SESSION',
  SAVE_SESSION: 'SAVE_SESSION',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  GET_CONFIG: 'GET_CONFIG'
};

// Default configuration
const DEFAULT_CONFIG = {
  autoUpdate: false,
  retrieveEndpoint: '',
  saveEndpoint: '',
  authHeaderName: 'X-aulasession-authenticate',
  authHeaderValue: ''
};

// Storage keys
const STORAGE_KEYS = {
  CONFIG: 'aulaConfig',
  CURRENT_SESSION: 'currentSessionId',
  STORED_SESSION: 'storedSession',
  LAST_CHECKED: 'lastChecked'
};

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

async function getConfig() {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
  return result[STORAGE_KEYS.CONFIG] || DEFAULT_CONFIG;
}

async function saveConfig(config) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: config });
}

async function getCurrentSessionId() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION);
  return result[STORAGE_KEYS.CURRENT_SESSION] || null;
}

async function saveCurrentSessionId(sessionId) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CURRENT_SESSION]: sessionId,
    [STORAGE_KEYS.LAST_CHECKED]: new Date().toISOString()
  });
}

async function getStoredSession() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STORED_SESSION);
  return result[STORAGE_KEYS.STORED_SESSION] || null;
}

async function saveStoredSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEYS.STORED_SESSION]: session });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

// Validate that a session ID is a 32-character string of lowercase letters and numbers
function isValidSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  // Session ID must be exactly 32 characters, containing only lowercase letters and numbers
  const sessionIdRegex = /^[a-z0-9]{32}$/;
  return sessionIdRegex.test(sessionId);
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

// Build headers object with optional authentication
function buildHeaders(authHeaderName, authHeaderValue) {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Only add auth header if name is provided and not empty
  if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue;
  }

  return headers;
}

async function fetchStoredSession(endpoint, authHeaderName, authHeaderValue) {
  if (!endpoint) {
    throw new Error('Retrieve endpoint not configured');
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: buildHeaders(authHeaderName, authHeaderValue)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

async function postSession(endpoint, sessionId, authHeaderName, authHeaderValue) {
  if (!endpoint) {
    throw new Error('Save endpoint not configured');
  }

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  // Validate session ID format
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid session ID format. Must be 32 lowercase alphanumeric characters.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(authHeaderName, authHeaderValue),
    body: JSON.stringify({
      sessionId: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// ============================================================================
// SESSION DETECTION
// ============================================================================

// Get PHPSESSID from cookies API
// The cookie is likely on the /api path, so we need to check there
async function getSessionIdFromCookies() {
  try {
    // Try with /api path first (where the cookie is actually set)
    let cookie = await chrome.cookies.get({
      url: 'https://www.aula.dk/api',
      name: 'PHPSESSID'
    });

    // If not found, try root path
    if (!cookie) {
      cookie = await chrome.cookies.get({
        url: 'https://www.aula.dk',
        name: 'PHPSESSID'
      });
    }

    // If still not found, get ALL cookies and find PHPSESSID
    if (!cookie) {
      const allCookies = await chrome.cookies.getAll({
        domain: '.aula.dk',
        name: 'PHPSESSID'
      });

      if (allCookies.length > 0) {
        cookie = allCookies[0];
      }
    }

    return cookie?.value || null;
  } catch (error) {
    console.error('Error getting cookie:', error);
    return null;
  }
}

// Auto-update logic: compare current session with stored session
async function checkAndUpdateSession(currentSessionId, config) {
  try {
    // Validate session ID before proceeding
    if (!isValidSessionId(currentSessionId)) {
      console.error('Auto-update: Invalid session ID format, skipping update:', currentSessionId);
      return;
    }

    // Get stored session from backend
    const storedSession = await fetchStoredSession(
      config.retrieveEndpoint,
      config.authHeaderName,
      config.authHeaderValue
    );

    // Cache it locally
    await saveStoredSession(storedSession);

    // Compare with current session
    if (storedSession.sessionId !== currentSessionId) {
      console.log('Auto-update: Session IDs differ, updating backend...', {
        current: currentSessionId,
        stored: storedSession.sessionId
      });

      const updatedSession = await postSession(
        config.saveEndpoint,
        currentSessionId,
        config.authHeaderName,
        config.authHeaderValue
      );
      await saveStoredSession(updatedSession);
      console.log('Auto-update: Backend updated with new session ID');
    }
  } catch (error) {
    console.error('Error in auto-update:', error);
  }
}

// ============================================================================
// POLLING FOR SESSION
// ============================================================================

async function pollForSession() {
  try {
    // Use the getSessionIdFromCookies function which tries multiple paths
    const sessionId = await getSessionIdFromCookies();

    if (sessionId) {
      console.log('✓ Session poll found PHPSESSID:', sessionId);
      await saveCurrentSessionId(sessionId);

      // Check if auto-update is enabled
      const config = await getConfig();
      if (config.autoUpdate && config.retrieveEndpoint && config.saveEndpoint) {
        await checkAndUpdateSession(sessionId, config);
      }
    }
    // Note: Suppressing "not found" logs to reduce console noise when logged out
  } catch (error) {
    console.error('Error polling for session:', error);
  }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle SESSION_DETECTED message from content script
  if (message.type === 'SESSION_DETECTED' && message.sessionId) {
    console.log('✓ Received session from content script:', message.sessionId);

    saveCurrentSessionId(message.sessionId).then(async () => {
      const config = await getConfig();
      if (config.autoUpdate && config.retrieveEndpoint && config.saveEndpoint) {
        await checkAndUpdateSession(message.sessionId, config);
      }
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error saving session from content script:', error);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Async response
  }

  // Handle other message types
  handleMessage(message)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      console.error('Error handling message:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });

  return true; // Async response
});

async function handleMessage(message) {
  switch (message.type) {
    case MessageType.GET_CURRENT_SESSION: {
      // Try to get from cookies first, fallback to storage
      let sessionId = await getSessionIdFromCookies();
      if (!sessionId) {
        sessionId = await getCurrentSessionId();
      }
      return {
        success: true,
        data: { sessionId }
      };
    }

    case MessageType.GET_STORED_SESSION: {
      const config = await getConfig();
      if (!config.retrieveEndpoint) {
        throw new Error('Retrieve endpoint not configured');
      }

      const storedSession = await fetchStoredSession(
        config.retrieveEndpoint,
        config.authHeaderName,
        config.authHeaderValue
      );
      await saveStoredSession(storedSession);

      return {
        success: true,
        data: storedSession
      };
    }

    case MessageType.SAVE_SESSION: {
      const config = await getConfig();
      if (!config.saveEndpoint) {
        throw new Error('Save endpoint not configured');
      }

      const { sessionId } = message.payload;
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Validate session ID format before saving
      if (!isValidSessionId(sessionId)) {
        throw new Error('Invalid session ID format. Must be 32 lowercase alphanumeric characters.');
      }

      const savedSession = await postSession(
        config.saveEndpoint,
        sessionId,
        config.authHeaderName,
        config.authHeaderValue
      );
      await saveStoredSession(savedSession);

      return {
        success: true,
        data: savedSession
      };
    }

    case MessageType.GET_CONFIG: {
      const config = await getConfig();
      return {
        success: true,
        data: config
      };
    }

    case MessageType.UPDATE_CONFIG: {
      await saveConfig(message.payload);
      return {
        success: true
      };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('Starting session polling...');

// Start polling immediately and then every 5 seconds
pollForSession();
const pollInterval = setInterval(pollForSession, 5000);

console.log('=== Service Worker Loaded Successfully ===');
console.log('Session polling active (every 5 seconds)');
console.log('Listening for messages from popup and content scripts');
