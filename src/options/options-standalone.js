// Aula Session Manager - Options Script (Standalone, no modules)

// MessageType enum (inline)
const MessageType = {
  GET_CURRENT_SESSION: 'GET_CURRENT_SESSION',
  GET_STORED_SESSION: 'GET_STORED_SESSION',
  SAVE_SESSION: 'SAVE_SESSION',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  GET_CONFIG: 'GET_CONFIG'
};

// DOM elements
const elements = {
  form: document.getElementById('settingsForm'),
  autoUpdate: document.getElementById('autoUpdate'),
  baseUrl: document.getElementById('baseUrl'),
  retrieveEndpoint: document.getElementById('retrieveEndpoint'),
  saveEndpoint: document.getElementById('saveEndpoint'),
  authHeaderName: document.getElementById('authHeaderName'),
  authHeaderValue: document.getElementById('authHeaderValue'),
  newsletterEndpoint: document.getElementById('newsletterEndpoint'),
  lastNumberOfDays: document.getElementById('lastNumberOfDays'),
  futureDays: document.getElementById('futureDays'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  messageArea: document.getElementById('messageArea'),
  messageText: document.getElementById('messageText')
};

// Default configuration
const DEFAULT_CONFIG = {
  autoUpdate: false,
  baseUrl: '',
  retrieveEndpoint: '',
  saveEndpoint: '',
  authHeaderName: 'X-aulasession-authenticate',
  authHeaderValue: '',
  newsletterEndpoint: '',
  lastNumberOfDays: 3,
  futureDays: 14
};

// Load configuration from storage
async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG
    });

    if (response.success) {
      const config = response.data;
      populateForm(config);
    } else {
      throw new Error(response.error || 'Failed to load configuration');
    }
  } catch (error) {
    showMessage('Error loading configuration: ' + error.message, 'error');
    populateForm(DEFAULT_CONFIG);
  }
}

// Populate form with configuration values
function populateForm(config) {
  elements.autoUpdate.checked = config.autoUpdate;
  elements.baseUrl.value = config.baseUrl || '';
  elements.retrieveEndpoint.value = config.retrieveEndpoint;
  elements.saveEndpoint.value = config.saveEndpoint;
  elements.authHeaderName.value = config.authHeaderName || 'X-aulasession-authenticate';
  elements.authHeaderValue.value = config.authHeaderValue || '';
  elements.newsletterEndpoint.value = config.newsletterEndpoint || '';
  elements.lastNumberOfDays.value = config.lastNumberOfDays || 3;
  elements.futureDays.value = config.futureDays || 14;
}

// Save configuration
async function saveConfig(event) {
  event.preventDefault();

  const config = {
    autoUpdate: elements.autoUpdate.checked,
    baseUrl: elements.baseUrl.value.trim(),
    retrieveEndpoint: elements.retrieveEndpoint.value.trim(),
    saveEndpoint: elements.saveEndpoint.value.trim(),
    authHeaderName: elements.authHeaderName.value.trim(),
    authHeaderValue: elements.authHeaderValue.value.trim(),
    newsletterEndpoint: elements.newsletterEndpoint.value.trim(),
    lastNumberOfDays: parseInt(elements.lastNumberOfDays.value, 10) || 3,
    futureDays: parseInt(elements.futureDays.value, 10) || 14
  };

  // Validate base URL if provided
  if (config.baseUrl && !isValidUrl(config.baseUrl)) {
    showMessage('Invalid base URL', 'error');
    return;
  }

  // Validate endpoints (build full URLs and validate)
  const retrieveUrl = buildFullUrl(config.baseUrl, config.retrieveEndpoint);
  if (config.retrieveEndpoint && retrieveUrl && !isValidUrl(retrieveUrl)) {
    showMessage('Invalid retrieve endpoint URL', 'error');
    return;
  }

  const saveUrl = buildFullUrl(config.baseUrl, config.saveEndpoint);
  if (config.saveEndpoint && saveUrl && !isValidUrl(saveUrl)) {
    showMessage('Invalid save endpoint URL', 'error');
    return;
  }

  const newsletterUrl = buildFullUrl(config.baseUrl, config.newsletterEndpoint);
  if (config.newsletterEndpoint && newsletterUrl && !isValidUrl(newsletterUrl)) {
    showMessage('Invalid newsletter endpoint URL', 'error');
    return;
  }

  // Validate number fields
  if (config.lastNumberOfDays < 1 || config.lastNumberOfDays > 365) {
    showMessage('Last Number of Days must be between 1 and 365', 'error');
    return;
  }

  if (config.futureDays < 1 || config.futureDays > 365) {
    showMessage('Future Days must be between 1 and 365', 'error');
    return;
  }

  try {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    const response = await chrome.runtime.sendMessage({
      type: MessageType.UPDATE_CONFIG,
      payload: config
    });

    if (response.success) {
      showMessage('Settings saved successfully!', 'success');
    } else {
      throw new Error(response.error || 'Failed to save configuration');
    }
  } catch (error) {
    showMessage('Error saving settings: ' + error.message, 'error');
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Save Settings';
  }
}

// Reset to default configuration
function resetConfig() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    populateForm(DEFAULT_CONFIG);
    showMessage('Settings reset to defaults. Click "Save Settings" to apply.', 'info');
  }
}

// Test connection to backend
async function testConnection() {
  const baseUrl = elements.baseUrl.value.trim();
  const retrieveEndpoint = elements.retrieveEndpoint.value.trim();

  if (!retrieveEndpoint) {
    showMessage('Please enter a retrieve endpoint URL first', 'error');
    return;
  }

  // Build full URL
  const fullUrl = buildFullUrl(baseUrl, retrieveEndpoint);

  if (!fullUrl || !isValidUrl(fullUrl)) {
    showMessage('Invalid retrieve endpoint URL', 'error');
    return;
  }

  try {
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.textContent = 'Testing...';

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: buildHeaders(
        elements.authHeaderName.value.trim(),
        elements.authHeaderValue.value.trim()
      )
    });

    if (response.ok) {
      const data = await response.json();

      // Validate response structure
      if (validateAulaSessionResponse(data)) {
        showMessage(
          `Connection successful! Retrieved session ID: ${data.sessionId.substring(0, 20)}...`,
          'success'
        );
      } else {
        showMessage(
          'Connection successful but response format is invalid. Expected: {Id, sessionId, lastUpdated, ttl}',
          'error'
        );
      }
    } else {
      showMessage(`Connection failed: HTTP ${response.status} ${response.statusText}`, 'error');
    }
  } catch (error) {
    showMessage(
      'Connection failed: ' + error.message + '. Check your endpoint URL and CORS settings.',
      'error'
    );
  } finally {
    elements.testConnectionBtn.disabled = false;
    elements.testConnectionBtn.textContent = 'Test Connection';
  }
}

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

// Build full URL from base URL and path
function buildFullUrl(baseUrl, path) {
  // If path is empty, return empty
  if (!path) {
    return '';
  }

  // If path is already a full URL, return it as-is (backward compatibility)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // If no base URL, return path as-is (backward compatibility)
  if (!baseUrl) {
    return path;
  }

  // Remove trailing slash from base URL
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : '/' + path;

  return cleanBase + cleanPath;
}

// Validate URL format
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validate AulaSession response structure
function validateAulaSessionResponse(data) {
  return (
    data &&
    typeof data.Id === 'number' &&
    typeof data.sessionId === 'string' &&
    typeof data.lastUpdated === 'string' &&
    typeof data.ttl === 'number' &&
    // created is optional for backward compatibility
    (data.created === undefined || typeof data.created === 'string')
  );
}

// Show message to user
function showMessage(message, type) {
  elements.messageText.textContent = message;
  elements.messageArea.className = `message-area ${type}`;

  setTimeout(() => {
    elements.messageArea.classList.add('hidden');
  }, 5000);
}

// Event listeners
elements.form.addEventListener('submit', saveConfig);
elements.resetBtn.addEventListener('click', resetConfig);
elements.testConnectionBtn.addEventListener('click', testConnection);

// Load configuration on page load
document.addEventListener('DOMContentLoaded', loadConfig);
