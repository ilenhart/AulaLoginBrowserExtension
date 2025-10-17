// Backend session response interface
export interface AulaSession {
  Id: string;
  sessionId: string;
  created: string;
  lastUpdated: string;
  ttl: number;
}

// Extension configuration settings
export interface ExtensionConfig {
  autoUpdate: boolean;
  retrieveEndpoint: string;
  saveEndpoint: string;
}

// Current session state in the extension
export interface SessionState {
  currentSessionId: string | null;
  storedSession: AulaSession | null;
  lastChecked: string;
}

// Message types for communication between popup and background
export enum MessageType {
  GET_CURRENT_SESSION = 'GET_CURRENT_SESSION',
  GET_STORED_SESSION = 'GET_STORED_SESSION',
  SAVE_SESSION = 'SAVE_SESSION',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  GET_CONFIG = 'GET_CONFIG'
}

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}
