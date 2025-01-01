import {
  IncomingMessage,
  IncomingMessageSchema,
  OutgoingMessage,
} from "../types/interfaces";
import { BASE_URL } from "../utils/constants";

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private messageHandler: ((message: IncomingMessage) => void) | null = null;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  setMessageHandler(handler: (message: IncomingMessage) => void) {
    this.messageHandler = handler;
  }

  connect(token: string, channelName: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws/${channelName}`;

    this.ws = new WebSocket(wsUrl, ["Authentication", token]);

    this.ws.onopen = () => {
      console.log("WebSocket connection established");
      this.clearReconnectTimer();
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.code}`);
      if (event.code !== 1000) {
        this.reconnect(token, channelName);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = IncomingMessageSchema.parse(data);
        this.messageHandler?.(message);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };
  }

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();

    if (this.ws) {
      try {
        this.ws.close(1000);
      } catch (error) {
        console.error("Failed to close WebSocket connection:", error);
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private reconnect(token: string, channelName: string): void {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.connect(token, channelName);
    }, 3000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
