import { OutgoingMessage, MessageType, IncomingMessageSchema } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { convertKeysToSnakeCase, convertKeysToCamelCase } from "../utils/dataFormatter";
import { SystemMessageHandler, ChannelMessageHandler } from "../contexts/webSocketContext";

export class WebSocketService {
  private static instance: WebSocketService;

  private systemSocket: WebSocket | null = null;
  private channelSocket: WebSocket | null = null;
  private systemConnected = false;
  private channelConnected = false;
  private reconnectTimeoutId: number | null = null;
  private currentChannelName: string | null = null;
  private currentToken: string | null = null;
  private connectionAttempts = { system: 0, channel: 0 };
  private maxReconnectAttempts = 5;
  private static connectionLock = false;
  private lastChannelConnectionAttemptTimestamp: number | null = null;

  private protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  private baseUrl = `${this.protocol}//${window.location.host}${BASE_URL}/ws`;

  // connection state change callbacks
  private connectionStateCallbacks: {
    onSystemConnectionChange?: (connected: boolean) => void;
    onChannelConnectionChange?: (connected: boolean) => void;
  } = {};

  private systemHandlers: SystemMessageHandler | null = null;
  private channelHandlers: ChannelMessageHandler | null = null;

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

  public setSystemHandlers(handlers: SystemMessageHandler): void {
    this.systemHandlers = handlers;
  }

  public setChannelHandlers(handlers: ChannelMessageHandler): void {
    this.channelHandlers = handlers;
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
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] System connection state changing to ${connected}`);
      }
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
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Channel connection state changing to ${connected}`);
      }
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
    // If already connected with same token, do nothing
    if (this.systemSocket?.readyState === WebSocket.OPEN && this.currentToken === token) {
      return;
    }

    // If locked, another connection attempt is in progress
    if (WebSocketService.connectionLock) {
      console.warn("[WebSocketService] System connection attempt skipped: lock active.");
      return;
    }

    WebSocketService.connectionLock = true;
    this.currentToken = token;

    this.establishSystemConnection();
  }

  private establishSystemConnection(): void {
    if (!this.currentToken) {
      WebSocketService.connectionLock = false;
      return;
    }

    // Close existing connection if any
    if (this.systemSocket) {
      this.systemSocket.close(1000);
      this.systemSocket = null;
    }

    if (import.meta.env.DEV) {
      console.log("[WebSocketService] Establishing system WebSocket connection...");
    }
    this.connectionAttempts.system++;

    this.systemSocket = new WebSocket(`${this.baseUrl}/system`, ["Authentication", this.currentToken]);

    this.systemSocket.onopen = () => {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] System WebSocket connected");
      }
      WebSocketService.connectionLock = false;
      this.updateSystemConnected(true);
      this.connectionAttempts.system = 0;
    };

    this.systemSocket.onclose = (event) => {
      console.log(`[WebSocketService] System WebSocket disconnected: ${event.code} ${event.reason}`);
      WebSocketService.connectionLock = false;
      this.updateSystemConnected(false);

      if (event.code !== 1000 && this.connectionAttempts.system < this.maxReconnectAttempts) {
        this.attemptReconnect("system");
      } else if (event.code !== 1000) {
        console.warn(
          `[WebSocketService] Max reconnect attempts (${this.maxReconnectAttempts}) reached for system socket. Giving up.`
        );
        this.connectionAttempts.system = 0;
      } else {
        this.connectionAttempts.system = 0;
      }
    };

    this.systemSocket.onerror = (error) => {
      console.error("[WebSocketService] System WebSocket error:", error);
    };

    this.systemSocket.onmessage = ((event: MessageEvent) => {
      this.handleIncomingMessage(event);
    }).bind(this);
  }

  // Connect to a specific channel
  public connectChannel(token: string, channelName: string): void {
    // If already connected to the same channel with the same token, do nothing
    if (
      this.channelSocket?.readyState === WebSocket.OPEN &&
      this.currentToken === token &&
      this.currentChannelName === channelName
    ) {
      return;
    }

    // If locked, another connection attempt is in progress
    if (WebSocketService.connectionLock) {
      console.warn("[WebSocketService] Channel connection attempt skipped: lock active.");
      return;
    }

    WebSocketService.connectionLock = true;
    this.currentToken = token;
    this.currentChannelName = channelName;

    this.establishChannelConnection();
  }

  private establishChannelConnection(): void {
    if (!this.currentToken || !this.currentChannelName) {
      WebSocketService.connectionLock = false;
      return;
    }

    // Close existing connection if any
    if (this.channelSocket) {
      this.channelSocket.close(1000);
      this.channelSocket = null;
    }

    if (import.meta.env.DEV) {
      console.log(`[WebSocketService] Establishing channel WebSocket connection: ${this.currentChannelName}`);
    }
    this.connectionAttempts.channel++;
    this.lastChannelConnectionAttemptTimestamp = Date.now();

    this.channelSocket = new WebSocket(`${this.baseUrl}/${this.currentChannelName}`, [
      "Authentication",
      this.currentToken,
    ]);

    this.channelSocket.onopen = () => {
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Channel WebSocket connected: ${this.currentChannelName}`);
      }
      WebSocketService.connectionLock = false;
      this.updateChannelConnected(true);
      this.connectionAttempts.channel = 0;
    };

    this.channelSocket.onclose = (event) => {
      console.log(`[WebSocketService] Channel WebSocket disconnected: ${event.code} ${event.reason}`);
      WebSocketService.connectionLock = false;
      this.updateChannelConnected(false);

      const timeSinceAttempt = this.lastChannelConnectionAttemptTimestamp
        ? Date.now() - this.lastChannelConnectionAttemptTimestamp
        : Infinity;

      if (event.code !== 1000 && timeSinceAttempt < 2000) {
        console.warn(
          `[WebSocketService] Channel socket closed quickly (${timeSinceAttempt}ms) after connection attempt (code: ${event.code}). Aborting automatic reconnect. Check token or channel validity.`
        );
        this.connectionAttempts.channel = 0;
      } else if (event.code !== 1000 && this.connectionAttempts.channel < this.maxReconnectAttempts) {
        this.attemptReconnect("channel");
      } else if (event.code !== 1000) {
        console.warn(
          `[WebSocketService] Max reconnect attempts (${this.maxReconnectAttempts}) reached for channel socket. Giving up.`
        );
        this.connectionAttempts.channel = 0;
      } else {
        this.connectionAttempts.channel = 0;
      }
    };

    this.channelSocket.onerror = (error) => {
      console.error("[WebSocketService] Channel WebSocket error:", error);
    };

    this.channelSocket.onmessage = ((event: MessageEvent) => {
      this.handleIncomingMessage(event);
    }).bind(this);
  }

  // Disconnect from current channel
  public disconnectChannel(): void {
    if (this.channelSocket) {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] Disconnecting channel WebSocket");
      }
      // Use normal closure code (1000) to indicate intentional disconnect
      this.channelSocket.close(1000);
      this.channelSocket = null;
      this.updateChannelConnected(false);
      this.currentChannelName = null;

      // Clear any pending explicit reconnect timeouts (though onclose handles implicit ones)
      if (this.reconnectTimeoutId) {
        window.clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
    }
  }

  // Disconnect system socket
  public disconnectSystem(): void {
    if (this.systemSocket) {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] Disconnecting system WebSocket");
      }
      // Use normal closure code (1000) to indicate intentional disconnect
      this.systemSocket.close(1000);
      this.systemSocket = null;
      this.updateSystemConnected(false);
    }
  }

  // Disconnect all sockets and reset state
  // This should only be used during logout or app cleanup
  public disconnectAll(): void {
    console.log("[WebSocketService] Disconnecting all WebSockets");
    this.disconnectSystem();
    this.disconnectChannel();
    this.currentToken = null;
    this.currentChannelName = null;
    this.connectionAttempts = { system: 0, channel: 0 };
  }

  // Send a message to the current channel
  public send(message: OutgoingMessage): void {
    // NOTE: ChannelUpdate messages are now exclusively sent by the backend
    //       in response to API actions (create/delete channel). This frontend
    //       service no longer needs to route them to the system socket.

    if (message.type === MessageType.ChannelUpdate) {
      console.error("[WebSocketService] Frontend should not send ChannelUpdate messages.");
      return;
    }

    if (!this.channelSocket || this.channelSocket.readyState !== WebSocket.OPEN) {
      console.error("[WebSocketService] Cannot send message: channel socket not connected or not open.");
      // Optional: Queue message or handle error appropriately
      return;
    }

    try {
      // Convert to snake_case for backend
      const snakeCaseMessage = convertKeysToSnakeCase(message) as OutgoingMessage;

      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Sending message type: ${message.type} to channel: ${message.channelName}`);
      }
      this.channelSocket.send(JSON.stringify(snakeCaseMessage));
    } catch (error) {
      console.error("[WebSocketService] Error sending message:", error);
    }
  }

  // Handle reconnection logic
  private attemptReconnect(socketType: "system" | "channel"): void {
    if (this.reconnectTimeoutId) {
      window.clearTimeout(this.reconnectTimeoutId);
    }

    const attempts = socketType === "system" ? this.connectionAttempts.system : this.connectionAttempts.channel;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);

    if (import.meta.env.DEV) {
      console.log(
        `[WebSocketService] Attempting to reconnect ${socketType} socket in ${delay / 1000}s (Attempt ${
          attempts + 1
        })...`
      );
    }

    this.reconnectTimeoutId = window.setTimeout(() => {
      if (socketType === "system" && this.currentToken) {
        this.establishSystemConnection();
      } else if (socketType === "channel" && this.currentToken && this.currentChannelName) {
        this.establishChannelConnection();
      }

      this.reconnectTimeoutId = null;
    }, delay);
  }

  // Process incoming messages
  private handleIncomingMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const message = IncomingMessageSchema.parse(convertKeysToCamelCase(data));

      // Add DEV flag for received message log
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Received message type: ${message.type}`, message);
      }

      // Route messages based on type
      switch (message.type) {
        // System messages
        case MessageType.ChannelUpdate:
          if (message.content.channelUpdate && this.systemHandlers?.onChannelUpdate) {
            const { action, channel } = message.content.channelUpdate;
            this.systemHandlers.onChannelUpdate(action, channel);
          } else {
            console.warn("[WebSocketService] Received ChannelUpdate but no system handler available");
          }
          break;

        case MessageType.SystemUserStatus:
          if (message.content.systemUserStatus) {
            const count = message.content.systemUserStatus.count;
            console.log("📊 Received system user count:", count);

            if (this.systemHandlers?.onSystemUserStatus) {
              console.log("📊 Calling system user status handler");
              this.systemHandlers.onSystemUserStatus(count);
            } else {
              console.warn("[WebSocketService] Received SystemUserStatus but no handler available");
            }
          }
          break;

        // Channel messages
        case MessageType.Text:
        case MessageType.Image:
          if (this.channelHandlers?.onChatMessage) {
            this.channelHandlers.onChatMessage(message);
          } else {
            console.warn("[WebSocketService] Received chat message but no channel handler available");
          }
          break;

        case MessageType.MemberUpdate:
          if (message.content.memberUpdate && this.channelHandlers?.onMemberUpdate) {
            this.channelHandlers.onMemberUpdate(message);
          } else {
            console.warn("[WebSocketService] Received MemberUpdate but no channel handler available");
          }
          break;

        case MessageType.UserStatus:
          if (message.content.userStatus && this.channelHandlers?.onUserStatus) {
            this.channelHandlers.onUserStatus(message.username, message.content.userStatus.action);
          } else {
            console.warn("[WebSocketService] Received UserStatus but no channel handler available");
          }
          break;

        default:
          console.warn(`[WebSocketService] Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      console.error("[WebSocketService] Error handling message:", error);
    }
  }
}
