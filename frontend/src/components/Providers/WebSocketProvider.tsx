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
      handlers: Object.keys(handlers.current),
    });

    if (message.type === MessageType.SketchUpdate || message.type === MessageType.ClearSketch) {
      handlers.current.onSketchMessage?.(message);
    } else {
      handlers.current.onChatMessage?.(message);
    }
  }, []);

  // Set up WebSocket message handler
  useEffect(() => {
    wsService.setMessageHandler(handleMessage);
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
