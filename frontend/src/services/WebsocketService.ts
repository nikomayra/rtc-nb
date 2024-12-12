import { IncomingMessage, IncomingMessageSchema, OutgoingMessage } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatInterval = 30000;
  private currentChannel: string | null = null;

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

  private startHeartbeat(token: string): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.currentChannel) {
        this.stopHeartbeat();
        return;
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        this.reconnect(token, this.currentChannel, true);
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  connect(token: string, channelName: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.currentChannel === channelName) return;

    if (this.currentChannel && this.currentChannel !== channelName) {
      this.disconnect();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws/${channelName}`;

    this.ws = new WebSocket(wsUrl, ['Authentication', token]);
    this.currentChannel = channelName;

    this.ws.onopen = () => {
      console.log('WebSocket connection established');
      this.onConnectionChange?.(true);
      this.clearReconnectTimer();
      this.startHeartbeat(token);
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code}`);
      this.onConnectionChange?.(false);
      this.stopHeartbeat();

      if (event.code !== 1000) {
        this.reconnect(token, channelName);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      try {
        this.ws.close(1000);
      } catch (error) {
        console.error('Failed to close WebSocket connection:', error);
      }
      this.ws = null;
    }
    this.currentChannel = null;
    this.onConnectionChange?.(false);
  }

  private reconnect(token: string, channelName: string, immediate: boolean = false): void {
    if (!channelName || !token) return;

    this.clearReconnectTimer();

    const attemptReconnect = () => {
      if (this.currentChannel === channelName) {
        this.disconnect();
        this.connect(token, channelName);
      }
    };

    if (immediate) {
      attemptReconnect();
    } else {
      this.reconnectTimer = window.setTimeout(attemptReconnect, 3000);
    }
  }

  // private reconnect(token: string): void {
  //   if (this.currentChannel) {
  //     this.connect(token, this.currentChannel);
  //   }
  // }

  // private scheduleReconnect(token: string, channelName: string): void {
  //   if (!this.reconnectTimer) {
  //     this.reconnectTimer = window.setTimeout(() => {
  //       this.connect(token, channelName);
  //     }, 3000);
  //   }
  // }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
