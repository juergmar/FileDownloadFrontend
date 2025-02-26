import {RxStompConfig} from '@stomp/rx-stomp';

export const rxStompConfig: RxStompConfig = {
  brokerURL: 'http://localhost:8080/ws',

  connectHeaders: {
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`
  },

  heartbeatIncoming: 1000,
  heartbeatOutgoing: 1000,

  reconnectDelay: 2000,

  debug: (msg: string): void => {
    console.log(new Date(), msg);
  }
};
