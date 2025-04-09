import { OutgoingMessage, MessageType, IncomingMessageSchema } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";
import { convertKeysToSnakeCase, convertKeysToCamelCase } from "../utils/dataFormatter";
import { SystemMessageHandler, ChannelMessageHandler } from "../contexts/webSocketContext";

// Type definition for the state setters passed from the React context
type ConnectionStateSetters = {
  setSystemConnected: (connected: boolean) => void;
  setChannelConnected: (connected: boolean) => void;
};

// Type definition for handler accessor functions passed from React context
type HandlerAccessors = {
  getSystemHandlers: () => Map<string, SystemMessageHandler>;
  getChannelHandlers: () => Map<string, ChannelMessageHandler>;
};

export class WebSocketService {
  private static instance: WebSocketService;

  private systemSocket: WebSocket | null = null;
  private channelSocket: WebSocket | null = null;
  // Separate reconnect timeout IDs
  private systemReconnectTimeoutId: number | null = null;
  private channelReconnectTimeoutId: number | null = null;
  private currentChannelName: string | null = null;
  private currentToken: string | null = null;
  // Separate connection attempts counters
  private connectionAttempts = { system: 0, channel: 0 };
  private maxReconnectAttempts = 5;
  private lastChannelConnectionAttemptTimestamp: number | null = null;

  private protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  private baseUrl = `${this.protocol}//${window.location.host}${BASE_URL}/ws`;

  // Use WeakMap to track intentionally closed sockets without modifying the socket object itself
  private closingIntentionallyMap = new WeakMap<WebSocket, boolean>();

  // State setters provided by the context
  private stateSetters: ConnectionStateSetters | null = null;
  // Accessor functions for handlers provided by context
  private handlerAccessors: HandlerAccessors | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public setStateSetters(setters: ConnectionStateSetters): void {
    this.stateSetters = setters;
  }

  // Method for Provider to set handler accessor functions
  public setHandlerAccessors(accessors: HandlerAccessors): void {
    this.handlerAccessors = accessors;
  }

  // Connect to the system socket
  public connectSystem(token: string): void {
    if (this.systemSocket?.readyState === WebSocket.OPEN && this.currentToken === token) {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] connectSystem called but system socket already open with same token.");
      }
      this.stateSetters?.setSystemConnected(true);
      return;
    }

    if (this.currentToken !== token || !this.systemSocket || this.systemSocket.readyState !== WebSocket.CONNECTING) {
      if (import.meta.env.DEV && this.currentToken && this.currentToken !== token) {
        console.log("[WebSocketService] connectSystem called with a new token. Re-establishing connection.");
      }
      this.currentToken = token;
      this.establishSystemConnection();
    } else if (this.systemSocket.readyState === WebSocket.CONNECTING) {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] connectSystem called while already connecting. Waiting for existing attempt.");
      }
    }
  }

  private establishSystemConnection(): void {
    if (!this.currentToken || !this.stateSetters) {
      console.error("[WebSocketService] Cannot establish system connection: Token or state setters missing.");
      return;
    }

    // Clear any pending reconnect timeout specifically for the system socket
    this.clearReconnectTimeout("system");

    // Close existing connection if any
    if (this.systemSocket) {
      if (import.meta.env.DEV) {
        console.log("[WebSocketService] Closing existing system socket before establishing new one.");
      }
      // Mark the socket for intentional closure using WeakMap
      this.closingIntentionallyMap.set(this.systemSocket, true);
      this.systemSocket.close(1000, "Establishing new system connection");
      this.systemSocket = null;
      // Immediately update state to false
      this.stateSetters.setSystemConnected(false);
    }

    if (import.meta.env.DEV) {
      console.log("[WebSocketService] Establishing system WebSocket connection...");
    }
    // Increment attempts for *this specific* connection attempt cycle
    this.connectionAttempts.system++;

    const socket = new WebSocket(`${this.baseUrl}/system`, ["Authentication", this.currentToken]);
    this.systemSocket = socket;

    socket.onopen = () => {
      if (socket === this.systemSocket) {
        if (import.meta.env.DEV) {
          console.log("[WebSocketService] System WebSocket connected");
        }
        this.stateSetters?.setSystemConnected(true);
        this.connectionAttempts.system = 0; // Reset attempts on success
        this.closingIntentionallyMap.delete(socket);
      } else {
        if (import.meta.env.DEV) {
          console.warn("[WebSocketService] Ignoring onopen event from stale system socket.");
        }
      }
    };

    socket.onclose = (event) => {
      const targetSocket = event.target as WebSocket;
      const closingIntentionally = this.closingIntentionallyMap.get(targetSocket);
      this.closingIntentionallyMap.delete(targetSocket); // Clean up map entry

      // Process only if it's the current socket or the current socket is already nullified
      if (socket === this.systemSocket || !this.systemSocket) {
        console.log(`[WebSocketService] System WebSocket disconnected: ${event.code} ${event.reason}`);
        this.stateSetters?.setSystemConnected(false);

        if (socket === this.systemSocket) {
          this.systemSocket = null; // Nullify the reference *after* processing
        }

        // Reconnect logic only if not intentionally closed and under max attempts
        if (
          event.code !== 1000 &&
          !closingIntentionally &&
          this.connectionAttempts.system < this.maxReconnectAttempts
        ) {
          this.scheduleReconnect("system"); // Use the scheduling function
        } else {
          if (event.code !== 1000 && !closingIntentionally) {
            console.warn(
              `[WebSocketService] Max reconnect attempts (${this.maxReconnectAttempts}) reached for system socket or non-recoverable closure. Giving up.`
            );
          }
          // Reset attempts if giving up, closed normally, or closed intentionally
          this.connectionAttempts.system = 0;
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn("[WebSocketService] Ignoring onclose event from stale system socket.");
        }
      }
    };

    socket.onerror = (error) => {
      const targetSocket = error.target as WebSocket;
      // Process only if it's the current socket
      if (socket === this.systemSocket) {
        console.error("[WebSocketService] System WebSocket error:", error);
        this.closingIntentionallyMap.delete(targetSocket);
        // Note: 'onclose' will usually follow 'onerror' and handle state/reconnect logic.
      } else {
        if (import.meta.env.DEV) {
          console.warn("[WebSocketService] Ignoring onerror event from stale system socket.");
        }
      }
    };

    socket.onmessage = ((event: MessageEvent) => {
      if (socket === this.systemSocket) {
        this.handleIncomingMessage(event);
      } else {
        if (import.meta.env.DEV) {
          console.warn("[WebSocketService] Ignoring onmessage event from stale system socket.");
        }
      }
    }).bind(this);
  }

  // Connect to a specific channel
  public connectChannel(token: string, channelName: string): void {
    if (
      this.channelSocket?.readyState === WebSocket.OPEN &&
      this.currentToken === token &&
      this.currentChannelName === channelName
    ) {
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] connectChannel called for ${channelName} but already connected.`);
      }
      this.stateSetters?.setChannelConnected(true);
      return;
    }

    // Determine if switching channels or connecting anew
    const isSwitching = this.currentChannelName && this.currentChannelName !== channelName;
    const needsNewConnection =
      isSwitching ||
      this.currentToken !== token ||
      !this.channelSocket ||
      this.channelSocket.readyState === WebSocket.CLOSED ||
      this.channelSocket.readyState === WebSocket.CLOSING;

    if (needsNewConnection) {
      if (import.meta.env.DEV && isSwitching) {
        console.log(
          `[WebSocketService] connectChannel: Switching from channel (${this.currentChannelName}) to (${channelName})`
        );
      }
      this.currentToken = token;
      this.currentChannelName = channelName; // Set the target channel name *before* establishing
      this.establishChannelConnection();
    } else if (this.channelSocket?.readyState === WebSocket.CONNECTING && this.currentChannelName === channelName) {
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] connectChannel called for ${channelName} while already connecting. Waiting.`);
      }
    }
  }

  private establishChannelConnection(): void {
    if (!this.currentToken || !this.currentChannelName || !this.stateSetters) {
      console.error(
        "[WebSocketService] Cannot establish channel connection: Token, channel name, or state setters missing."
      );
      return;
    }

    // Clear any pending reconnect timeout specifically for the channel socket
    this.clearReconnectTimeout("channel");

    // --- Pre-Connection Cleanup ---
    if (this.channelSocket) {
      const oldChannelName = this.channelSocket.url.split("/").pop() || "[unknown]";
      if (import.meta.env.DEV) {
        console.log(
          `[WebSocketService] establishChannelConnection: Closing existing channel socket (Channel: ${oldChannelName}, State: ${this.channelSocket.readyState}) before creating new one for ${this.currentChannelName}`
        );
      }
      this.closingIntentionallyMap.set(this.channelSocket, true);
      this.channelSocket.close(1000, `Switching to channel ${this.currentChannelName}`);
      this.channelSocket = null;
      this.stateSetters.setChannelConnected(false);
    }
    // --- End Pre-Connection Cleanup ---

    if (import.meta.env.DEV) {
      console.log(`[WebSocketService] Establishing channel WebSocket connection: ${this.currentChannelName}`);
    }
    // Increment attempts for *this specific* connection attempt cycle
    this.connectionAttempts.channel++;
    this.lastChannelConnectionAttemptTimestamp = Date.now(); // Track time for quick close detection

    const socket = new WebSocket(`${this.baseUrl}/${this.currentChannelName}`, ["Authentication", this.currentToken]);
    this.channelSocket = socket;

    socket.onopen = () => {
      if (socket === this.channelSocket) {
        if (import.meta.env.DEV) {
          console.log(`[WebSocketService] Channel WebSocket connected: ${this.currentChannelName}`);
        }
        this.stateSetters?.setChannelConnected(true);
        this.connectionAttempts.channel = 0; // Reset attempts on success
        this.closingIntentionallyMap.delete(socket);
      } else {
        if (import.meta.env.DEV) {
          // Use the intended channel name for logging clarity
          console.warn(
            `[WebSocketService] Ignoring onopen event from stale channel socket intended for ${this.currentChannelName}.`
          );
        }
      }
    };

    socket.onclose = (event) => {
      const targetSocket = event.target as WebSocket;
      const closedChannelName = targetSocket.url.split("/").pop() || "[unknown channel]";
      const closingIntentionally = this.closingIntentionallyMap.get(targetSocket);
      this.closingIntentionallyMap.delete(targetSocket);

      // Process only if it's the current socket or the current socket is already nullified
      if (socket === this.channelSocket || !this.channelSocket) {
        console.log(
          `[WebSocketService] Channel WebSocket disconnected from ${closedChannelName}: ${event.code} ${event.reason}`
        );
        this.stateSetters?.setChannelConnected(false);

        // Nullify the reference and potentially the current channel name *after* processing
        if (socket === this.channelSocket) {
          this.channelSocket = null;
          // Only clear the *current* channel name if the disconnected socket was for that channel
          // This prevents race conditions where disconnectAll clears it prematurely
          if (this.currentChannelName === closedChannelName) {
            this.currentChannelName = null;
          }
        }

        const timeSinceAttempt = this.lastChannelConnectionAttemptTimestamp
          ? Date.now() - this.lastChannelConnectionAttemptTimestamp
          : Infinity;

        // --- Reconnect Logic ---
        // Conditions: Not intentional, not code 1000, under max attempts, and *still targeting a channel*
        const shouldAttemptReconnect = event.code !== 1000 && !closingIntentionally && !!this.currentChannelName;

        if (shouldAttemptReconnect) {
          // Check for rapid close on the *first* reconnect attempt only
          if (timeSinceAttempt < 2000 && this.connectionAttempts.channel === 1) {
            console.warn(
              `[WebSocketService] Channel socket for ${closedChannelName} closed quickly (${timeSinceAttempt}ms) after connection attempt (code: ${event.code}). Aborting automatic reconnect. Check token or channel validity.`
            );
            this.connectionAttempts.channel = 0; // Reset attempts
          } else if (this.connectionAttempts.channel < this.maxReconnectAttempts) {
            this.scheduleReconnect("channel"); // Use the scheduling function
          } else {
            console.warn(
              `[WebSocketService] Max reconnect attempts (${this.maxReconnectAttempts}) reached for channel socket ${closedChannelName}. Giving up.`
            );
            this.connectionAttempts.channel = 0; // Reset attempts after giving up
          }
        } else {
          if (!closingIntentionally && event.code !== 1000 && !this.currentChannelName && import.meta.env.DEV) {
            console.log(
              `[WebSocketService] Skipping reconnect for ${closedChannelName} as no channel is currently targeted.`
            );
          }
          // Reset attempts if closed normally, intentionally, not attempting reconnect, or giving up
          this.connectionAttempts.channel = 0;
        }
        // --- End Reconnect Logic ---
      } else {
        if (import.meta.env.DEV) {
          console.warn(
            `[WebSocketService] Ignoring onclose event from stale channel socket for ${closedChannelName}. Current target channel is ${this.currentChannelName}.`
          );
        }
      }
    };

    socket.onerror = (error) => {
      const targetSocket = error.target as WebSocket;
      if (socket === this.channelSocket) {
        const errorChannelName = this.currentChannelName || "[unknown channel]";
        console.error(`[WebSocketService] Channel WebSocket error for ${errorChannelName}:`, error);
        this.closingIntentionallyMap.delete(targetSocket);
        // 'onclose' should follow and handle state/reconnect
      } else {
        if (import.meta.env.DEV) {
          const eventChannelName = (targetSocket as WebSocket).url.split("/").pop() || "[unknown channel]";
          console.warn(`[WebSocketService] Ignoring onerror event from stale channel socket for ${eventChannelName}.`);
        }
      }
    };

    socket.onmessage = ((event: MessageEvent) => {
      if (socket === this.channelSocket) {
        this.handleIncomingMessage(event);
      } else {
        if (import.meta.env.DEV) {
          const eventChannelName = (event.target as WebSocket).url.split("/").pop() || "[unknown channel]";
          console.warn(
            `[WebSocketService] Ignoring onmessage event from stale channel socket for ${eventChannelName}.`
          );
        }
      }
    }).bind(this);
  }

  // Disconnect from current channel
  public disconnectChannel(reason: string = "Explicit disconnect"): void {
    this.clearReconnectTimeout("channel"); // Clear any pending reconnect for the channel
    if (this.channelSocket) {
      const socketToClose = this.channelSocket;
      const channelNameToDisconnect = this.currentChannelName;
      if (import.meta.env.DEV) {
        console.log(
          `[WebSocketService] Disconnecting channel WebSocket (Channel: ${channelNameToDisconnect}, State: ${socketToClose.readyState}). Reason: ${reason}`
        );
      }

      this.closingIntentionallyMap.set(socketToClose, true);
      this.channelSocket = null; // Nullify first
      this.currentChannelName = null; // Clear target channel name
      this.stateSetters?.setChannelConnected(false); // Update state

      socketToClose.close(1000, reason); // Close last
      this.connectionAttempts.channel = 0; // Reset attempts
    }
  }

  // Disconnect system socket
  public disconnectSystem(reason: string = "Explicit disconnect"): void {
    this.clearReconnectTimeout("system"); // Clear any pending reconnect for the system
    if (this.systemSocket) {
      const socketToClose = this.systemSocket;
      if (import.meta.env.DEV) {
        console.log(
          `[WebSocketService] Disconnecting system WebSocket (State: ${socketToClose.readyState}). Reason: ${reason}`
        );
      }

      this.closingIntentionallyMap.set(socketToClose, true);
      this.systemSocket = null; // Nullify first
      this.stateSetters?.setSystemConnected(false); // Update state

      socketToClose.close(1000, reason); // Close last
      this.connectionAttempts.system = 0; // Reset attempts
    }
  }

  // Disconnect all sockets and reset state
  public disconnectAll(): void {
    console.log("[WebSocketService] Disconnecting all WebSockets");
    this.disconnectSystem("Disconnecting all"); // Will clear system timeout
    this.disconnectChannel("Disconnecting all"); // Will clear channel timeout
    this.currentToken = null;
    // No need to clear timeouts again, disconnect* methods handle it.
    // Attempts are reset within disconnect* methods.
  }

  // Send a message to the current channel
  public send(message: OutgoingMessage): void {
    if (message.type === MessageType.ChannelUpdate) {
      console.error("[WebSocketService] Frontend should not send ChannelUpdate messages.");
      return;
    }

    if (!this.channelSocket || this.channelSocket.readyState !== WebSocket.OPEN) {
      // Use currentChannelName if available for better logging
      const targetChannel = message.channelName || this.currentChannelName || "[unknown]";
      console.error(
        `[WebSocketService] Cannot send message: channel socket for ${targetChannel} not connected or not open. State: ${this.channelSocket?.readyState}`
      );
      return;
    }

    try {
      const snakeCaseMessage = convertKeysToSnakeCase(message) as OutgoingMessage;
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Sending message type: ${message.type} to channel: ${message.channelName}`);
      }
      this.channelSocket.send(JSON.stringify(snakeCaseMessage));
    } catch (error) {
      console.error("[WebSocketService] Error sending message:", error);
    }
  }

  // --- Refactored Reconnect Logic ---

  private clearReconnectTimeout(socketType: "system" | "channel"): void {
    if (socketType === "system" && this.systemReconnectTimeoutId) {
      if (import.meta.env.DEV)
        console.log(
          `[WebSocketService] Clearing pending system reconnect timeout (ID: ${this.systemReconnectTimeoutId}).`
        );
      window.clearTimeout(this.systemReconnectTimeoutId);
      this.systemReconnectTimeoutId = null;
    } else if (socketType === "channel" && this.channelReconnectTimeoutId) {
      if (import.meta.env.DEV)
        console.log(
          `[WebSocketService] Clearing pending channel reconnect timeout (ID: ${this.channelReconnectTimeoutId}).`
        );
      window.clearTimeout(this.channelReconnectTimeoutId);
      this.channelReconnectTimeoutId = null;
    }
  }

  private scheduleReconnect(socketType: "system" | "channel"): void {
    // Ensure no timeout is already pending for this specific type
    this.clearReconnectTimeout(socketType);

    const attempts = socketType === "system" ? this.connectionAttempts.system : this.connectionAttempts.channel;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff

    if (import.meta.env.DEV) {
      console.log(
        `[WebSocketService] Scheduling reconnect for ${socketType} socket in ${
          delay / 1000
        }s (After failure attempt ${attempts})...`
      );
    }

    const timeoutId = window.setTimeout(() => {
      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Executing scheduled reconnect for ${socketType} socket.`);
      }

      // Clear the stored ID for this type *before* attempting connection
      if (socketType === "system") this.systemReconnectTimeoutId = null;
      else if (socketType === "channel") this.channelReconnectTimeoutId = null;

      // Check conditions *again* before actually connecting
      if (socketType === "system" && this.currentToken) {
        if (
          !this.systemSocket ||
          (this.systemSocket.readyState !== WebSocket.OPEN && this.systemSocket.readyState !== WebSocket.CONNECTING)
        ) {
          if (import.meta.env.DEV) console.log("[WebSocketService] Reconnect timeout: Establishing system connection.");
          this.establishSystemConnection();
        } else {
          if (import.meta.env.DEV)
            console.log(
              "[WebSocketService] Reconnect timeout: System socket already open/connecting. Skipping reconnect attempt."
            );
          this.connectionAttempts.system = 0; // Reset attempts as it's connected now
        }
      } else if (socketType === "channel" && this.currentToken && this.currentChannelName) {
        if (
          !this.channelSocket ||
          (this.channelSocket.readyState !== WebSocket.OPEN && this.channelSocket.readyState !== WebSocket.CONNECTING)
        ) {
          if (import.meta.env.DEV)
            console.log(
              `[WebSocketService] Reconnect timeout: Establishing channel connection for ${this.currentChannelName}.`
            );
          this.establishChannelConnection();
        } else {
          if (import.meta.env.DEV)
            console.log(
              `[WebSocketService] Reconnect timeout: Channel socket for ${this.currentChannelName} already open/connecting. Skipping reconnect attempt.`
            );
          this.connectionAttempts.channel = 0; // Reset attempts as it's connected now
        }
      } else {
        if (import.meta.env.DEV)
          console.warn(
            `[WebSocketService] Reconnect timeout: Could not reconnect ${socketType}. Missing token, channel name, or state invalid.`
          );
        // Reset attempts if conditions aren't met
        if (socketType === "system") this.connectionAttempts.system = 0;
        if (socketType === "channel") this.connectionAttempts.channel = 0;
      }
    }, delay);

    // Store the timeout ID for this type
    if (socketType === "system") this.systemReconnectTimeoutId = timeoutId;
    else if (socketType === "channel") this.channelReconnectTimeoutId = timeoutId;
  }

  // Process incoming messages (no changes needed here for reconnect/state logic)
  private handleIncomingMessage(event: MessageEvent): void {
    try {
      const rawData = event.data;
      // log raw incoming data
      // if (import.meta.env.DEV) console.log("[WebSocketService] Raw message received:", rawData);

      const data = JSON.parse(rawData);
      // Convert keys BEFORE validation
      const camelCaseData = convertKeysToCamelCase(data);

      // Validate the overall structure first
      const parseResult = IncomingMessageSchema.safeParse(camelCaseData);

      if (!parseResult.success) {
        console.error("[WebSocketService] Invalid message structure:", parseResult.error.flatten());
        return;
      }

      const message = parseResult.data;

      if (import.meta.env.DEV) {
        console.log(`[WebSocketService] Message Received (${message.type}):`, message);
      }

      // Determine if it's a system or channel message and get handlers
      const isSystemMessageType = [MessageType.ChannelUpdate, MessageType.SystemUserStatus].includes(message.type);

      if (isSystemMessageType) {
        const systemHandlersMap = this.handlerAccessors?.getSystemHandlers();
        if (systemHandlersMap) {
          systemHandlersMap.forEach((handlers, key) => {
            if (import.meta.env.DEV) console.log(`[WebSocketService] Invoking system handler: ${key}`);
            switch (message.type) {
              case MessageType.ChannelUpdate:
                handlers.onChannelUpdate?.(message);
                break;
              case MessageType.SystemUserStatus:
                handlers.onSystemUserStatus?.(message);
                break;
            }
          });
        }
      } else {
        const channelHandlersMap = this.handlerAccessors?.getChannelHandlers();
        if (channelHandlersMap) {
          channelHandlersMap.forEach((handlers, key) => {
            if (import.meta.env.DEV) console.log(`[WebSocketService] Invoking channel handler: ${key}`);
            // Ensure message is for the current channel (though server should handle this)
            if (message.channelName === this.currentChannelName) {
              switch (message.type) {
                case MessageType.Text:
                case MessageType.Image:
                  handlers.onChatMessage?.(message);
                  break;
                case MessageType.MemberUpdate:
                  handlers.onMemberUpdate?.(message);
                  break;
                case MessageType.UserStatus:
                  if (message.content.userStatus) {
                    handlers.onUserStatus?.(
                      message.content.userStatus.username,
                      message.content.userStatus.action as "online" | "offline"
                    );
                  }
                  break;
                case MessageType.Sketch:
                  handlers.onSketchMessage?.(message);
                  break;
              }
            }
          });
        }
      }
    } catch (error) {
      console.error("[WebSocketService] Error processing message:", error);
    }
  }
}
