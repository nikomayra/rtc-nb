import { BASE_URL } from '../utils/constants';

export const messagesApi = {
  ws: null as WebSocket | null,

  connectWebSocket: async (token: string): Promise<WebSocket> => {
    console.log('Closing any open WebSocket connection and creating a new one');
    messagesApi.closeConnection();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws`;

    const ws = new WebSocket(wsUrl, ['Authentication', token]);
    ws.onerror = (error) => {
      return new Error(`WebSocket connection failed ${error}`);
    };
    messagesApi.ws = ws;
    return ws;
    // return new Promise((resolve, reject) => {
    //   ws.onopen = () => resolve(ws);
    //   ws.onerror = (error) => {
    //     console.error('WebSocket error:', error);
    //     reject(new Error('WebSocket connection failed'));
    //   };
    // });
  },

  sendMessage: async (
    channelName: string,
    text: string,
    token: string
  ): Promise<void> => {
    let ws = messagesApi.ws;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = await messagesApi.connectWebSocket(token);
    }

    const message = {
      channelName,
      type: 0,
      text,
    };
    ws.send(JSON.stringify(message));
  },

  closeConnection: () => {
    if (messagesApi.ws) {
      messagesApi.ws.close();
      messagesApi.ws = null;
    }
  },
};
