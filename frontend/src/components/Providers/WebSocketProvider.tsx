import { useState, useCallback, useRef, useEffect } from "react";
import { WebSocketContext, MessageHandlers } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { IncomingMessage, MessageType } from "../../types/interfaces";

export const WebSocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsService = WebSocketService.getInstance();
  const handlers = useRef<MessageHandlers>({});

  const handleMessage = useCallback((message: IncomingMessage) => {
    console.log("📨 WebSocket message received:", {
      type: message.type,
      commandType: message.content.sketchCmd?.commandType,
      handlers: Object.keys(handlers.current),
    });

    try {
      if (message.type === MessageType.Sketch && handlers.current.onSketchMessage) {
        console.log("🎨 Routing to sketch handler");
        handlers.current.onSketchMessage(message);
      } else if (handlers.current.onChatMessage) {
        console.log("💬 Routing to chat handler");
        handlers.current.onChatMessage(message);
      }
    } catch (error) {
      console.error("Error in WebSocket message handler:", error);
    }
  }, []);

  // Set up WebSocket message handler
  useEffect(() => {
    console.log("⛑️ Setting up main WebSocket handler");
    wsService.setMessageHandler(handleMessage);

    return () => {
      console.log("🧼 Cleaning up main WebSocket handler");
      wsService.setMessageHandler(() => {});
    };
  }, [wsService, handleMessage]);

  // Update connection state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(wsService.isConnected());
    }, 1000);
    return () => clearInterval(interval);
  }, [wsService]);

  const contextValue = {
    state: {
      isConnected,
    },
    actions: {
      connect: wsService.connect.bind(wsService),
      disconnect: wsService.disconnect.bind(wsService),
      send: wsService.send.bind(wsService),
      setMessageHandlers: (newHandlers: MessageHandlers) => {
        handlers.current = {
          ...handlers.current,
          ...newHandlers,
        };
      },
    },
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
