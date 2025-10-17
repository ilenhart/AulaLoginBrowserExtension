import { MessageType, ExtensionConfig } from '../types';

// DOM elements
const elements = {
  form: document.getElementById('settingsForm') as HTMLFormElement,
  autoUpdate: document.getElementById('autoUpdate') as HTMLInputElement,
  retrieveEndpoint: document.getElementById('retrieveEndpoint') as HTMLInputElement,
  saveEndpoint: document.getElementById('saveEndpoint') as HTMLInputElement,
  saveBtn: document.getElementById('saveBtn') as HTMLButtonElement,
  resetBtn: document.getElementById('resetBtn') as HTMLButtonElement,
  testConnectionBtn: document.getElementById('testConnectionBtn') as HTMLButtonElement,
  messageArea: document.getElementById('messageArea') as HTMLDivElement,
  messageText: document.getElementById('messageText') as HTMLParagraphElement
};

// Default configuration
const DEFAULT_CONFIG: ExtensionConfig = {
  autoUpdate: false,
  retrieveEndpoint: '',
  saveEndpoint: ''
};

// Load configuration from storage
async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_CONFIG
    });

    if (response.success) {
      const config: ExtensionConfig = response.data;
      populateForm(config);
    } else {
      throw new Error(response.error || 'Failed to load configuration');
    }
  } catch (error) {
    showMessage('Error loading configuration: ' + (error as Error).message, 'error');
    populateForm(DEFAULT_CONFIG);
  }
}

// Populate form with configuration values
function populateForm(config: ExtensionConfig) {
  elements.autoUpdate.checked = config.autoUpdate;
  elements.retrieveEndpoint.value = config.retrieveEndpoint;
  elements.saveEndpoint.value = config.saveEndpoint;
}

// Save configuration
async function saveConfig(event: Event) {
  event.preventDefault();

  const config: ExtensionConfig = {
    autoUpdate: elements.autoUpdate.checked,
    retrieveEndpoint: elements.retrieveEndpoint.value.trim(),
    saveEndpoint: elements.saveEndpoint.value.trim()
  };

  // Validate endpoints
  if (config.retrieveEndpoint && !isValidUrl(config.retrieveEndpoint)) {
    showMessage('Invalid retrieve endpoint URL', 'error');
    return;
  }

  if (config.saveEndpoint && !isValidUrl(config.saveEndpoint)) {
    showMessage('Invalid save endpoint URL', 'error');
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
    showMessage('Error saving settings: ' + (error as Error).message, 'error');
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
  const retrieveEndpoint = elements.retrieveEndpoint.value.trim();

  if (!retrieveEndpoint) {
    showMessage('Please enter a retrieve endpoint URL first', 'error');
    return;
  }

  if (!isValidUrl(retrieveEndpoint)) {
    showMessage('Invalid retrieve endpoint URL', 'error');
    return;
  }

  try {
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.textContent = 'Testing...';

    const response = await fetch(retrieveEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
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
      'Connection failed: ' + (error as Error).message + '. Check your endpoint URL and CORS settings.',
      'error'
    );
  } finally {
    elements.testConnectionBtn.disabled = false;
    elements.testConnectionBtn.textContent = 'Test Connection';
  }
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validate AulaSession response structure
function validateAulaSessionResponse(data: any): boolean {
  return (
    data &&
    typeof data.Id === 'string' &&
    typeof data.sessionId === 'string' &&
    typeof data.lastUpdated === 'string' &&
    typeof data.ttl === 'number'
  );
}

// Show message to user
function showMessage(message: string, type: 'success' | 'error' | 'info') {
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
