import { ExtensionConfig, SessionState, AulaSession } from '../types';

// Default configuration values
const DEFAULT_CONFIG: ExtensionConfig = {
  autoUpdate: false,
  retrieveEndpoint: '',
  saveEndpoint: ''
};

// Storage keys
const STORAGE_KEYS = {
  CONFIG: 'aulaConfig',
  CURRENT_SESSION: 'currentSessionId',
  STORED_SESSION: 'storedSession',
  LAST_CHECKED: 'lastChecked'
};

export class StorageService {
  // Get extension configuration
  static async getConfig(): Promise<ExtensionConfig> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
    return result[STORAGE_KEYS.CONFIG] || DEFAULT_CONFIG;
  }

  // Save extension configuration
  static async saveConfig(config: ExtensionConfig): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: config });
  }

  // Get current session ID from local storage
  static async getCurrentSessionId(): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION);
    return result[STORAGE_KEYS.CURRENT_SESSION] || null;
  }

  // Save current session ID to local storage
  static async saveCurrentSessionId(sessionId: string): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CURRENT_SESSION]: sessionId,
      [STORAGE_KEYS.LAST_CHECKED]: new Date().toISOString()
    });
  }

  // Get stored session from backend (cached in local storage)
  static async getStoredSession(): Promise<AulaSession | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.STORED_SESSION);
    return result[STORAGE_KEYS.STORED_SESSION] || null;
  }

  // Save stored session to local storage (cache)
  static async saveStoredSession(session: AulaSession): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.STORED_SESSION]: session });
  }

  // Get last checked timestamp
  static async getLastChecked(): Promise<string> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECKED);
    return result[STORAGE_KEYS.LAST_CHECKED] || new Date().toISOString();
  }

  // Get complete session state
  static async getSessionState(): Promise<SessionState> {
    const [currentSessionId, storedSession, lastChecked] = await Promise.all([
      this.getCurrentSessionId(),
      this.getStoredSession(),
      this.getLastChecked()
    ]);

    return {
      currentSessionId,
      storedSession,
      lastChecked
    };
  }

  // Clear all stored data (useful for debugging)
  static async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
  }
}
