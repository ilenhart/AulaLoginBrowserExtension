import { MessageType, AulaSession, ExtensionConfig } from '../types';

// DOM elements - will be initialized when DOM is ready
let elements: {
  currentSessionId: HTMLSpanElement;
  storedSessionId: HTMLSpanElement;
  lastUpdated: HTMLSpanElement;
  ttl: HTMLSpanElement;
  statusIndicator: HTMLDivElement;
  statusText: HTMLSpanElement;
  saveBtn: HTMLButtonElement;
  refreshCurrentBtn: HTMLButtonElement;
  refreshStoredBtn: HTMLButtonElement;
  openOptionsBtn: HTMLButtonElement;
  messageArea: HTMLDivElement;
  messageText: HTMLParagraphElement;
  autoUpdateStatus: HTMLSpanElement;
};

// State
let currentSessionId: string | null = null;
let storedSession: AulaSession | null = null;
let config: ExtensionConfig | null = null;

// Initialize DOM elements
function initElements() {
  elements = {
    currentSessionId: document.getElementById('currentSessionId') as HTMLSpanElement,
    storedSessionId: document.getElementById('storedSessionId') as HTMLSpanElement,
    lastUpdated: document.getElementById('lastUpdated') as HTMLSpanElement,
    ttl: document.getElementById('ttl') as HTMLSpanElement,
    statusIndicator: document.getElementById('statusIndicator') as HTMLDivElement,
    statusText: document.getElementById('statusText') as HTMLSpanElement,
    saveBtn: document.getElementById('saveBtn') as HTMLButtonElement,
    refreshCurrentBtn: document.getElementById('refreshCurrentBtn') as HTMLButtonElement,
    refreshStoredBtn: document.getElementById('refreshStoredBtn') as HTMLButtonElement,
    openOptionsBtn: document.getElementById('openOptionsBtn') as HTMLButtonElement,
    messageArea: document.getElementById('messageArea') as HTMLDivElement,
    messageText: document.getElementById('messageText') as HTMLParagraphElement,
    autoUpdateStatus: document.getElementById('autoUpdateStatus') as HTMLSpanElement
  };
}

// Setup event listeners
function setupEventListeners() {
  elements.saveBtn.addEventListener('click', saveSession);

  elements.refreshCurrentBtn.addEventListener('click', async () => {
    await loadCurrentSession();
    updateUI();
  });

  elements.refreshStoredBtn.addEventListener('click', async () => {
    await loadStoredSession();
    updateUI();
  });

  elements.openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Initialize popup
async function init() {
  try {
    await loadConfig();
    await loadCurrentSession();
    await loadStoredSession();
    updateUI();
  } catch (error) {
    showMessage('Error initializing popup: ' + (error as Error).message, 'error');
  }
}

// Load configuration
async function loadConfig() {
  const response = await chrome.runtime.sendMessage({
    type: MessageType.GET_CONFIG
  });

  if (response.success) {
    config = response.data;
    updateAutoUpdateStatus();
  } else {
    throw new Error(response.error || 'Failed to load configuration');
  }
}

// Load current session from browser
async function loadCurrentSession() {
  const response = await chrome.runtime.sendMessage({
    type: MessageType.GET_CURRENT_SESSION
  });

  if (response.success) {
    currentSessionId = response.data.sessionId;
  } else {
    console.error('Failed to load current session:', response.error);
    currentSessionId = null;
  }
}

// Load stored session from backend
async function loadStoredSession() {
  if (!config?.retrieveEndpoint) {
    console.log('Retrieve endpoint not configured');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_STORED_SESSION
    });

    if (response.success) {
      storedSession = response.data;
    } else {
      console.error('Failed to load stored session:', response.error);
      storedSession = null;
    }
  } catch (error) {
    console.error('Error loading stored session:', error);
    storedSession = null;
  }
}

// Save current session to backend
async function saveSession() {
  if (!currentSessionId) {
    showMessage('No current session ID detected', 'error');
    return;
  }

  if (!config?.saveEndpoint) {
    showMessage('Save endpoint not configured. Please update settings.', 'error');
    return;
  }

  try {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    const response = await chrome.runtime.sendMessage({
      type: MessageType.SAVE_SESSION,
      payload: { sessionId: currentSessionId }
    });

    if (response.success) {
      storedSession = response.data;
      updateUI();
      showMessage('Session saved successfully!', 'success');
    } else {
      showMessage('Failed to save session: ' + response.error, 'error');
    }
  } catch (error) {
    showMessage('Error saving session: ' + (error as Error).message, 'error');
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Save Current Session to Backend';
  }
}

// Update UI with current data
function updateUI() {
  // Update current session display
  if (currentSessionId) {
    elements.currentSessionId.textContent = currentSessionId;
    elements.currentSessionId.classList.remove('empty');
    elements.saveBtn.disabled = false;
  } else {
    elements.currentSessionId.textContent = 'Not detected';
    elements.currentSessionId.classList.add('empty');
    elements.saveBtn.disabled = true;
  }

  // Update stored session display
  if (storedSession) {
    elements.storedSessionId.textContent = storedSession.sessionId;
    elements.storedSessionId.classList.remove('empty');

    // Format last updated date
    const lastUpdatedDate = new Date(storedSession.lastUpdated);
    elements.lastUpdated.textContent = formatDate(lastUpdatedDate);

    // Display TTL
    elements.ttl.textContent = `${storedSession.ttl} seconds`;

    // Update status indicator
    updateStatusIndicator();
  } else {
    elements.storedSessionId.textContent = 'Not loaded';
    elements.storedSessionId.classList.add('empty');
    elements.lastUpdated.textContent = '-';
    elements.ttl.textContent = '-';
    elements.statusIndicator.className = 'status-indicator unknown';
    elements.statusText.textContent = 'Status unknown';
  }
}

// Update status indicator based on session comparison
function updateStatusIndicator() {
  if (!currentSessionId || !storedSession) {
    elements.statusIndicator.className = 'status-indicator unknown';
    elements.statusText.textContent = 'Status unknown';
    return;
  }

  if (currentSessionId === storedSession.sessionId) {
    elements.statusIndicator.className = 'status-indicator match';
    elements.statusText.textContent = 'Sessions match';
  } else {
    elements.statusIndicator.className = 'status-indicator mismatch';
    elements.statusText.textContent = 'Sessions differ - update recommended';
  }
}

// Update auto-update status display
function updateAutoUpdateStatus() {
  if (config?.autoUpdate) {
    elements.autoUpdateStatus.textContent = 'Enabled';
    elements.autoUpdateStatus.className = 'enabled';
  } else {
    elements.autoUpdateStatus.textContent = 'Disabled';
    elements.autoUpdateStatus.className = 'disabled';
  }
}

// Show message to user
function showMessage(message: string, type: 'success' | 'error') {
  elements.messageText.textContent = message;
  elements.messageArea.className = `message-area ${type}`;

  setTimeout(() => {
    elements.messageArea.classList.add('hidden');
  }, 5000);
}

// Format date for display
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleString();
  }
}

// Main initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  setupEventListeners();
  init();
});
