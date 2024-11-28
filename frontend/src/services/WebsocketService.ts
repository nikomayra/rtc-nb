import { EventEmitter } from 'events';
import { z } from 'zod';
import { IncomingMessageSchema, OutgoingMessage } from '../types/interfaces';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private token: string | null = null;

  private constructor() {
    super();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(token: string): void {
    this.token = token;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    this.ws = new WebSocket(wsUrl, ['Authentication', token]);

    this.ws.onopen = () => {
      this.emit('connected');
      this.clearReconnectTimer();
    };

    this.ws.onclose = (event) => {
      this.emit('disconnected');
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const incomingMessage = IncomingMessageSchema.parse(data);
        this.emit('incoming_message', incomingMessage);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Failed to parse message:', error.errors);
        } else {
          console.error('Failed to parse message:', error);
        }
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.clearReconnectTimer();
  }

  send(outGoingMessage: OutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(outGoingMessage));
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer && this.token) {
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.token!);
      }, 3000);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
