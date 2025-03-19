import { IncomingMessage, IncomingMessageSchema, OutgoingMessage, MessageType } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "../utils/dataFormatter";

export class WebSocketService {
  private static instance: WebSocketService;
  private systemWs: WebSocket | null = null;
  private channelWs: WebSocket | null = null;
  private messageHandler: ((message: IncomingMessage) => void) | null = null;
  private connectionStateHandler: ((systemConnected: boolean, channelConnected: boolean) => void) | null = null;
  private currentToken: string | null = null;
  private currentChannel: string | null = null;
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
    return type === "system" ? `${baseUrl}/system` : `${baseUrl}/${channelName}`;
  }

  connectSystem(token: string): void {
    // Skip if connection is in progress
    if (this.connecting.system) {
      console.log("System connection already in progress");
      return;
    }

    // Don't reconnect if already connected with same token
    if (this.systemWs?.readyState === WebSocket.OPEN && this.currentToken === token) {
      console.log("System already connected");
      return;
    }

    // Mark connection as in progress
    this.connecting.system = true;

    // Close existing connection first
    this.closeConnection(this.systemWs);
    this.systemWs = null;
    this.currentToken = token;

    try {
      const wsUrl = this.getWebSocketUrl("system");
      console.log("Connecting to system websocket:", wsUrl);

      this.systemWs = new WebSocket(wsUrl, ["Authentication", token]);

      this.systemWs.onopen = () => {
        console.log("System WebSocket connected");
        this.connecting.system = false;
        this.updateConnectionState();
      };

      this.systemWs.onclose = () => {
        console.log("System WebSocket closed");
        this.systemWs = null;
        this.connecting.system = false;
        this.updateConnectionState();
      };

      this.systemWs.onerror = (error) => {
        console.error("System WebSocket error:", error);
        this.connecting.system = false;
      };

      this.systemWs.onmessage = (event) => {
        this.handleMessage(event, "system");
      };
    } catch (error) {
      console.error("Failed to connect to system websocket:", error);
      this.systemWs = null;
      this.connecting.system = false;
      this.updateConnectionState();
    }
  }

  connectChannel(token: string, channelName: string): void {
    // Skip if connection is in progress
    if (this.connecting.channel) {
      console.log("Channel connection already in progress");
      return;
    }

    // Don't reconnect if already connected to same channel with same token
    if (
      this.channelWs?.readyState === WebSocket.OPEN &&
      this.currentChannel === channelName &&
      this.currentToken === token
    ) {
      console.log("Channel already connected");
      return;
    }

    // Mark connection as in progress
    this.connecting.channel = true;

    // Close existing connection first
    this.closeConnection(this.channelWs);
    this.channelWs = null;
    this.currentChannel = channelName;
    this.currentToken = token;

    try {
      const wsUrl = this.getWebSocketUrl("channel", channelName);
      console.log(`Connecting to channel websocket: ${wsUrl}`);

      this.channelWs = new WebSocket(wsUrl, ["Authentication", token]);

      this.channelWs.onopen = () => {
        console.log("Channel WebSocket connected");
        this.connecting.channel = false;
        this.updateConnectionState();
      };

      this.channelWs.onclose = () => {
        console.log("Channel WebSocket closed");
        this.channelWs = null;
        this.currentChannel = null;
        this.connecting.channel = false;
        this.updateConnectionState();
      };

      this.channelWs.onerror = (error) => {
        console.error("Channel WebSocket error:", error);
        this.connecting.channel = false;
      };

      this.channelWs.onmessage = (event) => {
        this.handleMessage(event, "channel");
      };
    } catch (error) {
      console.error("Failed to connect to channel websocket:", error);
      this.channelWs = null;
      this.currentChannel = null;
      this.connecting.channel = false;
      this.updateConnectionState();
    }
  }

  private handleMessage(event: MessageEvent, source: string): void {
    try {
      if (typeof event.data !== "string") {
        console.error(`Invalid message from ${source}:`, event.data);
        return;
      }

      const data = JSON.parse(event.data);
      const message = IncomingMessageSchema.parse(convertKeysToCamelCase(data));

      console.log(`Message from ${source}:`, { type: message.type, id: message.id });

      if (this.messageHandler) {
        this.messageHandler(message);
      }
    } catch (error) {
      console.error(`Error processing message from ${source}:`, error);
    }
  }

  private closeConnection(ws: WebSocket | null): void {
    if (!ws) return;

    // Only attempt to close if not already closing/closed
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        // Remove all event listeners first to prevent the onclose from firing during the current operation
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;

        // Close the connection
        ws.close();
      } catch (err) {
        console.error("Error closing websocket:", err);
      }
    }
  }

  disconnect(): void {
    this.currentChannel = null;
    this.closeConnection(this.channelWs);
    this.channelWs = null;
    this.updateConnectionState();
  }

  disconnectAll(): void {
    this.disconnect();
    this.currentToken = null;
    this.closeConnection(this.systemWs);
    this.systemWs = null;
    this.updateConnectionState();
  }

  send(message: OutgoingMessage): void {
    // Determine which websocket to use based on message type
    const useSystemWs = message.type === MessageType.ChannelUpdate || message.type === MessageType.MemberUpdate;
    const ws = useSystemWs ? this.systemWs : this.channelWs;
    const wsType = useSystemWs ? "system" : "channel";

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message: ${wsType} websocket not connected`);
      return;
    }

    try {
      const formattedMessage = convertKeysToSnakeCase(message);
      console.log(`Sending ${wsType} message:`, { type: message.type });
      ws.send(JSON.stringify(formattedMessage));
    } catch (error) {
      console.error(`Error sending message on ${wsType} websocket:`, error);
    }
  }

  private updateConnectionState(): void {
    const systemConnected = this.systemWs?.readyState === WebSocket.OPEN;
    const channelConnected = this.channelWs?.readyState === WebSocket.OPEN;

    if (this.connectionStateHandler) {
      this.connectionStateHandler(systemConnected, channelConnected);
    }
  }

  setConnectionStateHandler(handler: ((systemConnected: boolean, channelConnected: boolean) => void) | null): void {
    this.connectionStateHandler = handler;

    // Call immediately with current state if handler exists
    if (handler) {
      const systemConnected = this.systemWs?.readyState === WebSocket.OPEN;
      const channelConnected = this.channelWs?.readyState === WebSocket.OPEN;
      handler(systemConnected, channelConnected);
    }
  }

  setMessageHandler(handler: ((message: IncomingMessage) => void) | null): void {
    this.messageHandler = handler;
  }
}
