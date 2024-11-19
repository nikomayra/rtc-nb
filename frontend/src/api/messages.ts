import { BASE_URL } from '../utils/constants';

export const messagesApi = {
  connectWebSocket: async (token: string): Promise<WebSocket> => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws`;

    const ws = new WebSocket(wsUrl, ['Authentication', token]);

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  },

  sendMessage: async (channelName: string, text: string, token: string) => {
    const ws = await messagesApi.connectWebSocket(token);
    const message = {
      channelName,
      type: 0,
      text,
    };
    ws.send(JSON.stringify(message));
  },
};
