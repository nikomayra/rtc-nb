import { useState, useCallback, useRef, useEffect, useContext } from "react";
import { WebSocketContext, MessageHandlers } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { IncomingMessage, MessageType } from "../../types/interfaces";
import { AuthContext } from "../../contexts/authContext";

export const WebSocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [systemConnected, setSystemConnected] = useState(false);
  const [channelConnected, setChannelConnected] = useState(false);
  const wsService = WebSocketService.getInstance();
  const handlers = useRef<MessageHandlers>({});
  const setupDoneRef = useRef(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("AuthContext not found");
  }

  const {
    state: { token },
  } = authContext;

  // Handle incoming messages
  const handleMessage = useCallback((message: IncomingMessage) => {
    console.log("📨 WebSocket message received:", {
      type: message.type,
      handlers: Object.keys(handlers.current),
    });

    try {
      switch (message.type) {
        case MessageType.Sketch:
          if (handlers.current.onSketchMessage) {
            console.log("🎨 Routing to sketch handler");
            handlers.current.onSketchMessage(message);
          }
          break;
        case MessageType.ChannelUpdate:
          if (handlers.current.onChannelUpdate) {
            console.log("📢 Routing to channel update handler");
            handlers.current.onChannelUpdate(message);
          }
          break;
        case MessageType.MemberUpdate:
          if (handlers.current.onMemberUpdate) {
            console.log("👥 Routing to member update handler");
            handlers.current.onMemberUpdate(message);
          }
          break;
        default:
          if (handlers.current.onChatMessage) {
            console.log("💬 Routing to chat handler");
            handlers.current.onChatMessage(message);
          }
      }
    } catch (error) {
      console.error("Error in message handler:", error);
    }
  }, []);

  // Set up handlers and connections
  useEffect(() => {
    // Prevent setup from running twice in React Strict Mode
    if (setupDoneRef.current) {
      return;
    }

    console.log("⛑️ Setting up WebSocket handlers");

    // Set flag to prevent duplicate setups
    setupDoneRef.current = true;

    // Setup message and connection state handlers
    wsService.setMessageHandler(handleMessage);
    wsService.setConnectionStateHandler((system, channel) => {
      setSystemConnected(system);
      setChannelConnected(channel);
    });

    // Connect system websocket if token exists
    if (token) {
      // Use a small timeout to ensure the DOM is settled before connection
      setTimeout(() => {
        wsService.connectSystem(token);
      }, 100);
    } else {
      wsService.disconnectAll();
    }

    // Cleanup on unmount
    return () => {
      console.log("🧼 Cleaning up WebSocket handlers");
      wsService.setMessageHandler(null);
      wsService.setConnectionStateHandler(null);
      wsService.disconnectAll();
      setupDoneRef.current = false;
    };
  }, [wsService, handleMessage, token]);

  // Create context value
  const contextValue = {
    state: {
      systemConnected,
      channelConnected,
    },
    actions: {
      connectChannel: wsService.connectChannel.bind(wsService),
      connectSystem: wsService.connectSystem.bind(wsService),
      disconnect: wsService.disconnect.bind(wsService),
      disconnectAll: wsService.disconnectAll.bind(wsService),
      send: wsService.send.bind(wsService),
      setMessageHandlers: (newHandlers: MessageHandlers) => {
        handlers.current = { ...handlers.current, ...newHandlers };
      },
    },
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
