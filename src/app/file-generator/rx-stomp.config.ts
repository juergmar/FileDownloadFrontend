// rx-stomp.config.ts
import { RxStompConfig } from '@stomp/rx-stomp';

export const rxStompConfig: RxStompConfig = {
  // URL to your websocket endpoint
  brokerURL: 'http://localhost:8080/ws',

  // Connection headers (e.g., authorization)
  connectHeaders: {
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  },

  // How often to send heartbeats, in milliseconds
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,

  // Wait 5 seconds before attempting reconnect
  reconnectDelay: 5000,

  // Optional: log debug messages to console
  debug: (msg: string): void => {
    console.log(new Date(), msg);
  }
};
