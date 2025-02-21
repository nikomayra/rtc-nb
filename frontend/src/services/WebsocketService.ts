import { IncomingMessage, IncomingMessageSchema, OutgoingMessage, MessageType } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "../utils/dataFormatter";

export class WebSocketService {
  private static instance: WebSocketService;
  private channelWs: WebSocket | null = null;
  private systemWs: WebSocket | null = null;
  private messageHandler: ((message: IncomingMessage) => void) | null = null;
  private connectionStateHandler: ((systemConnected: boolean, channelConnected: boolean) => void) | null = null;
  private currentToken: string | null = null;
  private currentChannel: string | null = null;
  private lastConnectionState = { system: false, channel: false };
  private connecting = { system: false, channel: false };

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getWebSocketUrl(type: "system" | "channel", channelName?: string): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = `${protocol}//${window.location.host}${BASE_URL}/ws`;
    return `${baseUrl}/${type === "system" ? "system" : channelName}`;
  }

  connectSystem(token: string): void {
    if (this.connecting.system) {
      console.log("🔄 System connection already in progress");
      return;
    }
    if (this.systemWs?.readyState === WebSocket.OPEN && this.currentToken === token) {
      console.log("✅ System already connected");
      return;
    }

    console.log("🔌 Initiating system connection");
    this.connecting.system = true;
    this.currentToken = token;

    if (this.systemWs) {
      console.log("🔄 Closing existing system connection");
      this.systemWs.close(1000);
      this.systemWs = null;
    }

    try {
      const wsUrl = this.getWebSocketUrl("system");
      this.systemWs = new WebSocket(wsUrl, ["Authentication", token]);
      this.setupHandlers(this.systemWs, true);
    } catch (error) {
      console.error("❌ System connection failed:", error);
      this.connecting.system = false;
      this.updateConnectionState();
    }
  }

  connectChannel(token: string, channelName: string): void {
    if (this.connecting.channel) {
      console.log("🔄 Channel connection already in progress");
      return;
    }
    if (
      this.channelWs?.readyState === WebSocket.OPEN &&
      this.currentChannel === channelName &&
      this.currentToken === token
    ) {
      console.log("✅ Channel already connected");
      return;
    }

    console.log(`🔌 Initiating channel connection: ${channelName}`);
    this.connecting.channel = true;
    this.currentToken = token;
    this.currentChannel = channelName;

    if (this.channelWs) {
      console.log("🔄 Closing existing channel connection");
      this.channelWs.close(1000);
      this.channelWs = null;
    }

    try {
      const wsUrl = this.getWebSocketUrl("channel", channelName);
      this.channelWs = new WebSocket(wsUrl, ["Authentication", token]);
      this.setupHandlers(this.channelWs, false);
    } catch (error) {
      console.error("❌ Channel connection failed:", error);
      this.connecting.channel = false;
      this.updateConnectionState();
    }
  }

  private setupHandlers(ws: WebSocket, isSystem: boolean): void {
    const type = isSystem ? "system" : "channel";

    ws.onopen = () => {
      console.log(`✅ ${type} WebSocket connected`);
      this.connecting[type] = false;
      this.updateConnectionState();
    };

    ws.onclose = (event) => {
      console.log(`❌ ${type} WebSocket closed:`, event.code);
      this.connecting[type] = false;
      if (isSystem && ws === this.systemWs) {
        this.systemWs = null;
      } else if (!isSystem && ws === this.channelWs) {
        this.channelWs = null;
      }
      this.updateConnectionState();
    };

    ws.onerror = (error) => {
      console.error(`❌ ${type} WebSocket error:`, error);
      this.connecting[type] = false;
      if (isSystem && ws === this.systemWs) {
        this.systemWs = null;
      } else if (!isSystem && ws === this.channelWs) {
        this.channelWs = null;
      }
      this.updateConnectionState();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = IncomingMessageSchema.parse(convertKeysToCamelCase(data));
        this.messageHandler?.(message);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };
  }

  disconnect(): void {
    this.currentChannel = null;
    if (this.channelWs) {
      this.channelWs.close(1000);
      this.channelWs = null;
    }
    this.updateConnectionState();
  }

  disconnectAll(): void {
    this.disconnect();
    this.currentToken = null;
    if (this.systemWs) {
      this.systemWs.close(1000);
      this.systemWs = null;
    }
    this.updateConnectionState();
  }

  send(message: OutgoingMessage): void {
    // Route system-level messages through system websocket
    const useSystemWs = message.type === MessageType.ChannelUpdate || message.type === MessageType.MemberUpdate;

    const ws = useSystemWs ? this.systemWs : this.channelWs;

    if (!ws) {
      console.error(`No ${useSystemWs ? "system" : "channel"} WebSocket connection available`);
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket is not in OPEN state (current state: ${ws.readyState})`);
      return;
    }
    const formattedMessage = convertKeysToSnakeCase(message);
    ws.send(JSON.stringify(formattedMessage));
  }

  private updateConnectionState(): void {
    const systemConnected = this.systemWs?.readyState === WebSocket.OPEN;
    const channelConnected = this.channelWs?.readyState === WebSocket.OPEN;

    if (
      this.connectionStateHandler &&
      (this.lastConnectionState.system !== systemConnected || this.lastConnectionState.channel !== channelConnected)
    ) {
      this.lastConnectionState = { system: systemConnected, channel: channelConnected };
      this.connectionStateHandler(systemConnected, channelConnected);
      console.log(`Connection state updated: system=${systemConnected}, channel=${channelConnected}`);
    }
  }

  setConnectionStateHandler(handler: ((systemConnected: boolean, channelConnected: boolean) => void) | null): void {
    this.connectionStateHandler = handler;
  }

  setMessageHandler(handler: ((message: IncomingMessage) => void) | null): void {
    this.messageHandler = handler;
  }
}
