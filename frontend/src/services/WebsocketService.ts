import { IncomingMessage, IncomingMessageSchema, OutgoingMessage } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  // Single callback for each type
  private onMessage: ((message: IncomingMessage) => void) | null = null;
  private onConnectionChange: ((isConnected: boolean) => void) | null = null;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  setCallbacks(callbacks: {
    onMessage: (message: IncomingMessage) => void;
    onConnectionChange: (isConnected: boolean) => void;
  }) {
    this.onMessage = callbacks.onMessage;
    this.onConnectionChange = callbacks.onConnectionChange;
  }

  connect(token: string, channelName: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws/${channelName}`;

    this.ws = new WebSocket(wsUrl, ['Authentication', token]);

    this.ws.onopen = () => {
      this.onConnectionChange?.(true);
      this.clearReconnectTimer();
    };

    this.ws.onclose = () => {
      this.onConnectionChange?.(false);
      this.scheduleReconnect(token, channelName);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = IncomingMessageSchema.parse(data);
        this.onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.clearReconnectTimer();
  }

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(token: string, channelName: string): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = window.setTimeout(() => {
        this.connect(token, channelName);
      }, 3000);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
