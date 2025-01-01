import { useEffect, useState } from "react";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { IncomingMessage, OutgoingMessage } from "../../types/interfaces";

export const WebSocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsService = WebSocketService.getInstance();

  // Update connection state periodically
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
      connect: (token: string, channelName: string) => {
        wsService.connect(token, channelName);
      },
      disconnect: () => {
        wsService.disconnect();
      },
      send: (message: OutgoingMessage) => {
        wsService.send(message);
      },
      setMessageHandler: (handler: (message: IncomingMessage) => void) => {
        wsService.setMessageHandler(handler);
      },
    },
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
