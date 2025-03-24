import { OutgoingMessage, IncomingMessage, MessageType } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { convertKeysToSnakeCase, convertKeysToCamelCase } from "../utils/dataFormatter";

type MessageHandler = (message: IncomingMessage) => void;

export interface MessageHandlers {
  onChatMessage?: MessageHandler;
  onChannelUpdate?: MessageHandler;
  onMemberUpdate?: MessageHandler;
  onSketchMessage?: MessageHandler;
}

export class WebSocketService {
  private static instance: WebSocketService;

  private systemSocket: WebSocket | null = null;
  private channelSocket: WebSocket | null = null;
  private systemConnected = false;
  private channelConnected = false;
  private messageHandlers: MessageHandlers = {};
  private reconnectTimeoutId: number | null = null;
  private currentChannelName: string | null = null;
  private currentToken: string | null = null;
  private connectionAttempts = { system: 0, channel: 0 };
  private maxReconnectAttempts = 3;

  private protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  private baseUrl = `${this.protocol}//${window.location.host}${BASE_URL}/ws`;

  // connection state change callbacks
  private connectionStateCallbacks: {
    onSystemConnectionChange?: (connected: boolean) => void;
    onChannelConnectionChange?: (connected: boolean) => void;
  } = {};

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public get isSystemConnected(): boolean {
    return this.systemConnected;
  }

  public get isChannelConnected(): boolean {
    return this.channelConnected;
  }

  public setMessageHandlers(handlers: MessageHandlers): void {
    this.messageHandlers = handlers;
  }

  // Register connection state change callbacks
  public setConnectionStateCallbacks(callbacks: {
    onSystemConnectionChange?: (connected: boolean) => void;
    onChannelConnectionChange?: (connected: boolean) => void;
  }): void {
    this.connectionStateCallbacks = { ...callbacks };
  }

  // Helper method to update system connection state
  private updateSystemConnected(connected: boolean): void {
    // Only update if state actually changed
    if (this.systemConnected !== connected) {
      console.log(`WebSocketService: System connection state changing to ${connected}`);
      this.systemConnected = connected;

      // Call callback immediately outside of any potential React batching
      if (this.connectionStateCallbacks.onSystemConnectionChange) {
        setTimeout(() => {
          this.connectionStateCallbacks.onSystemConnectionChange?.(connected);
        }, 0);
      }
    }
  }

  // Helper method to update channel connection state
  private updateChannelConnected(connected: boolean): void {
    // Only update if state actually changed
    if (this.channelConnected !== connected) {
      console.log(`WebSocketService: Channel connection state changing to ${connected}`);
      this.channelConnected = connected;

      // Call callback immediately outside of any potential React batching
      if (this.connectionStateCallbacks.onChannelConnectionChange) {
        setTimeout(() => {
          this.connectionStateCallbacks.onChannelConnectionChange?.(connected);
        }, 0);
      }
    }
  }

  // Connect to the system socket - used for global updates
  public connectSystem(token: string): void {
    if (this.systemSocket?.readyState === WebSocket.OPEN && this.currentToken === token) {
      console.log("System socket already connected");
      return;
    }

    // Check if we've exceeded max reconnect attempts
    if (this.connectionAttempts.system >= this.maxReconnectAttempts) {
      console.log("Max system connection attempts reached, giving up");
      return;
    }

    // Close existing connection first
    if (this.systemSocket) {
      this.systemSocket.close();
      this.systemSocket = null;
    }

    this.currentToken = token;
    this.connectionAttempts.system++;

    console.log("Connecting to system WebSocket...");
    this.systemSocket = new WebSocket(`${this.baseUrl}/system`, ["Authentication", token]);

    this.systemSocket.onopen = () => {
      console.log("System WebSocket connected");
      this.updateSystemConnected(true);
      // Reset attempts counter on successful connection
      this.connectionAttempts.system = 0;
    };

    this.systemSocket.onclose = (event) => {
      console.log(`System WebSocket disconnected: ${event.code} ${event.reason}`);
      this.updateSystemConnected(false);
      this.attemptReconnect("system");
    };

    this.systemSocket.onerror = (error) => {
      console.error("System WebSocket error:", error);
    };

    this.systemSocket.onmessage = ((event: MessageEvent) => {
      this.handleIncomingMessage(event, "system");
    }).bind(this);
  }

  // Connect to a specific channel
  public connectChannel(token: string, channelName: string): void {
    if (
      this.channelSocket?.readyState === WebSocket.OPEN &&
      this.currentChannelName === channelName &&
      this.currentToken === token
    ) {
      console.log(`Already connected to channel: ${channelName}`);
      return;
    }

    // Check if we've exceeded max reconnect attempts
    if (this.connectionAttempts.channel >= this.maxReconnectAttempts) {
      console.log("Max channel connection attempts reached, giving up");
      return;
    }

    // Disconnect from previous channel if connected
    this.disconnectChannel();

    this.currentToken = token;
    this.currentChannelName = channelName;
    this.connectionAttempts.channel++;

    console.log(`Connecting to channel WebSocket: ${channelName}`);
    this.channelSocket = new WebSocket(`${this.baseUrl}/${channelName}`, ["Authentication", token]);

    this.channelSocket.onopen = () => {
      console.log(`Channel WebSocket connected: ${channelName}`);
      this.updateChannelConnected(true);
      // Reset attempts counter on successful connection
      this.connectionAttempts.channel = 0;
    };

    this.channelSocket.onclose = (event) => {
      console.log(`Channel WebSocket disconnected: ${event.code} ${event.reason}`);
      this.updateChannelConnected(false);
      this.attemptReconnect("channel");
    };

    this.channelSocket.onerror = (error) => {
      console.error("Channel WebSocket error:", error);
    };

    this.channelSocket.onmessage = ((event: MessageEvent) => {
      this.handleIncomingMessage(event, "channel");
    }).bind(this);
  }

  // Disconnect from current channel
  public disconnectChannel(): void {
    if (this.channelSocket) {
      console.log("Disconnecting channel WebSocket");
      this.channelSocket.close();
      this.channelSocket = null;
      this.updateChannelConnected(false);
      this.currentChannelName = null;

      // Clear any pending reconnects
      if (this.reconnectTimeoutId) {
        window.clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
    }
  }

  // Disconnect system socket
  public disconnectSystem(): void {
    if (this.systemSocket) {
      console.log("Disconnecting system WebSocket");
      this.systemSocket.close();
      this.systemSocket = null;
      this.updateSystemConnected(false);
    }
  }

  // Disconnect all sockets and reset state
  // This should only be used during logout or app cleanup
  public disconnectAll(): void {
    console.log("Disconnecting all WebSockets");
    this.disconnectSystem();
    this.disconnectChannel();
    this.currentToken = null;

    // Reset connection attempts
    this.connectionAttempts = { system: 0, channel: 0 };
  }

  // Send a message to the current channel
  public send(message: OutgoingMessage): void {
    try {
      // Convert to snake_case for backend
      const snakeCaseMessage = convertKeysToSnakeCase(message) as OutgoingMessage;

      // Only ChannelUpdate messages go through system socket
      if (message.type === MessageType.ChannelUpdate) {
        if (!this.systemSocket || this.systemSocket.readyState !== WebSocket.OPEN) {
          console.error("Cannot send system message: system socket not connected");
          return;
        }
        console.log(`Sending system message type: ${message.type}`);
        this.systemSocket.send(JSON.stringify(snakeCaseMessage));
        return;
      }

      // All other messages go through channel socket
      if (!this.channelSocket || this.channelSocket.readyState !== WebSocket.OPEN) {
        console.error("Cannot send message: channel socket not connected");
        return;
      }
      console.log(`Sending message type: ${message.type} to channel: ${message.channelName}`);
      this.channelSocket.send(JSON.stringify(snakeCaseMessage));
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  // Handle reconnection logic
  private attemptReconnect(socketType: "system" | "channel", delay = 3000): void {
    if (this.reconnectTimeoutId) {
      window.clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = window.setTimeout(() => {
      console.log(`Attempting to reconnect ${socketType} socket...`);

      if (socketType === "system" && this.currentToken) {
        this.connectSystem(this.currentToken);
      } else if (socketType === "channel" && this.currentToken && this.currentChannelName) {
        this.connectChannel(this.currentToken, this.currentChannelName);
      }

      this.reconnectTimeoutId = null;
    }, delay);
  }

  // Process incoming messages
  private handleIncomingMessage(event: MessageEvent, socketType: "system" | "channel"): void {
    try {
      if (typeof event.data !== "string") {
        console.error("Invalid message format:", event.data);
        return;
      }

      // Parse and convert from snake_case to camelCase
      const rawMessage = JSON.parse(event.data);
      const message = convertKeysToCamelCase(rawMessage) as IncomingMessage;

      console.log(`Received ${socketType} message type: ${message.type} from channel: ${message.channelName}`);

      // Handle system messages (ChannelUpdate only)
      if (socketType === "system") {
        if (message.type === MessageType.ChannelUpdate) {
          this.messageHandlers.onChannelUpdate?.(message);
        } else {
          console.warn("Received non-system message type on system socket:", message.type);
        }
        return;
      }

      // Handle all channel messages
      switch (message.type) {
        case MessageType.Text:
        case MessageType.Image:
        case MessageType.UserStatus:
          this.messageHandlers.onChatMessage?.(message);
          break;

        case MessageType.Sketch:
          this.messageHandlers.onSketchMessage?.(message);
          break;

        case MessageType.MemberUpdate:
          this.messageHandlers.onMemberUpdate?.(message);
          break;

        default:
          console.warn("Unhandled message type:", message.type);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }
}
