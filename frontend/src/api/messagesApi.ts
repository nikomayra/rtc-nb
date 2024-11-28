import { BASE_URL } from '../utils/constants';
import { OutgoingMessage } from '../types/interfaces';

export const messagesApi = {
  ws: null as WebSocket | null,

  connectWebSocket: async (token: string): Promise<WebSocket> => {
    if (messagesApi.ws?.readyState === WebSocket.OPEN) {
      return messagesApi.ws;
    }

    console.log('Creating new WebSocket connection');
    messagesApi.closeConnection();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, ['Authentication', token]);

      ws.onopen = () => {
        messagesApi.ws = ws;
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };
    });
  },

  sendMessage: async (
    message: OutgoingMessage,
    token: string
  ): Promise<void> => {
    try {
      const ws = await messagesApi.connectWebSocket(token);
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  closeConnection: () => {
    if (messagesApi.ws) {
      messagesApi.ws.close();
      messagesApi.ws = null;
    }
  },
};
