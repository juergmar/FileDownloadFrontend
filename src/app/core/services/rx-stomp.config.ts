// rx-stomp.config.ts
import { RxStompConfig } from '@stomp/rx-stomp';
import { environment } from '../auth/auth-config';

// We need a consistent WebSocket URL regardless of token changes
// Hard-code the base URL to ensure consistency
const WS_BASE_URL = 'ws://localhost:8080/ws';

export const rxStompConfig: RxStompConfig = {
  // Use a function to create the complete URL with token
  // This will be called each time we connect
  brokerURL: WS_BASE_URL,

  // Empty connect headers since we'll pass token as query param
  connectHeaders: {},

  // Heartbeat configuration
  heartbeatIncoming: 5000,
  heartbeatOutgoing: 5000,

  // Reconnect settings
  reconnectDelay: 5000,

  // Debug function - helpful for troubleshooting but can be noisy
  debug: (msg: string): void => {
    if (!environment.production) {
      console.log(`[WebSocket] ${new Date().toISOString()}: ${msg}`);
    }
  }
};

// Helper function to get the complete WebSocket URL with token
export function getWebSocketUrl(token: string): string {
  // Ensure the URL is always correctly formed
  if (!token) {
    console.error('No token provided for WebSocket connection');
    return WS_BASE_URL;
  }

  return `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
}
