import { AulaSession } from '../types';

export class ApiService {
  /**
   * Fetch the stored session from the backend
   */
  static async getStoredSession(endpoint: string): Promise<AulaSession> {
    if (!endpoint) {
      throw new Error('Retrieve endpoint not configured');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AulaSession = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching stored session:', error);
      throw error;
    }
  }

  /**
   * Save the session ID to the backend
   */
  static async saveSession(endpoint: string, sessionId: string): Promise<AulaSession> {
    if (!endpoint) {
      throw new Error('Save endpoint not configured');
    }

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AulaSession = await response.json();
      return data;
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  /**
   * Check if the backend is reachable
   */
  static async healthCheck(endpoint: string): Promise<boolean> {
    try {
      await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}
