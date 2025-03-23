import React, { useState, useEffect } from "react";
import { WebSocketContext, MessageHandlers, WebSocketContextType } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { OutgoingMessage } from "../../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [systemConnected, setSystemConnected] = useState(false);
  const [channelConnected, setChannelConnected] = useState(false);

  // Get the singleton instance
  const wsService = WebSocketService.getInstance();

  // Update connection state regularly
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemConnected(wsService.isSystemConnected);
      setChannelConnected(wsService.isChannelConnected);
    }, 1000);

    return () => clearInterval(interval);
  }, [wsService.isChannelConnected, wsService.isSystemConnected]);

  // Clean up websocket connections on unmount
  useEffect(() => {
    return () => {
      wsService.disconnect();
    };
  }, [wsService]);

  // Create context value with all required methods
  const contextValue: WebSocketContextType = {
    state: {
      systemConnected,
      channelConnected,
    },
    actions: {
      connectSystem: (token: string) => wsService.connectSystem(token),
      connectChannel: (token: string, channelName: string) => wsService.connectChannel(token, channelName),
      disconnect: () => wsService.disconnect(),
      disconnectAll: () => wsService.disconnectAll(),
      send: (message: OutgoingMessage) => wsService.send(message),
      setMessageHandlers: (handlers: MessageHandlers) => wsService.setMessageHandlers(handlers),
    },
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
