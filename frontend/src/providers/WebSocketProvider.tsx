import React, { useState, useEffect, useMemo } from "react";
import { ChannelMessageHandler, SystemMessageHandler, WebSocketContext } from "../contexts/webSocketContext";
import { WebSocketService } from "../services/WebsocketService";
import { OutgoingMessage } from "../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [systemConnected, setSystemConnected] = useState(false);
  const [channelConnected, setChannelConnected] = useState(false);
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  // Add Mount log
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[WebSocketProvider] Mounted.");
    }
  }, []);

  // Handle connection state changes
  useEffect(() => {
    wsService.setConnectionStateCallbacks({
      onSystemConnectionChange: setSystemConnected,
      onChannelConnectionChange: setChannelConnected,
    });

    return () => {
      wsService.setConnectionStateCallbacks({});
    };
  }, [wsService]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (import.meta.env.DEV) {
        console.log("[WebSocketProvider] Unmounting WebSocketProvider, disconnecting all.");
      }
      wsService.disconnectAll();
    };
  }, [wsService]);

  const actions = useMemo(
    () => ({
      connectSystem: (token: string) => {
        wsService.connectSystem(token);
      },
      connectChannel: (token: string, channelName: string) => wsService.connectChannel(token, channelName),
      disconnectChannel: () => wsService.disconnectChannel(),
      disconnectAll: () => wsService.disconnectAll(),
      send: (message: OutgoingMessage) => wsService.send(message),
      setSystemHandlers: (handlers: SystemMessageHandler) => {
        wsService.setSystemHandlers(handlers);
      },
      setChannelHandlers: (handlers: ChannelMessageHandler) => {
        wsService.setChannelHandlers(handlers);
      },
    }),
    [wsService]
  );

  // Create context value, now only state depends on changing values
  const contextValue = useMemo(
    () => ({
      state: {
        systemConnected,
        channelConnected,
      },
      actions,
    }),
    [systemConnected, channelConnected, actions]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
