import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { WebSocketContext, MessageHandlers } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { OutgoingMessage } from "../../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [systemConnected, setSystemConnected] = useState(false);
  const [channelConnected, setChannelConnected] = useState(false);
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  // Refs to track current state
  const systemConnectedRef = useRef(false);
  const channelConnectedRef = useRef(false);

  // Callbacks for connection state changes
  const handleSystemConnectionChange = useCallback((isConnected: boolean) => {
    console.log("System connection state changed:", isConnected, "(direct callback)");
    systemConnectedRef.current = isConnected;
    setSystemConnected(isConnected);
  }, []);

  const handleChannelConnectionChange = useCallback((isConnected: boolean) => {
    console.log("Channel connection state changed:", isConnected, "(direct callback)");
    channelConnectedRef.current = isConnected;
    setChannelConnected(isConnected);
  }, []);

  // Register callbacks on mount
  useEffect(() => {
    wsService.setConnectionStateCallbacks({
      onSystemConnectionChange: handleSystemConnectionChange,
      onChannelConnectionChange: handleChannelConnectionChange,
    });

    // Get initial state
    systemConnectedRef.current = wsService.isSystemConnected;
    channelConnectedRef.current = wsService.isChannelConnected;

    setSystemConnected(wsService.isSystemConnected);
    setChannelConnected(wsService.isChannelConnected);

    return () => {
      // Clear callbacks on unmount
      wsService.setConnectionStateCallbacks({});
    };
  }, [handleSystemConnectionChange, handleChannelConnectionChange, wsService]);

  // Clean up websocket connections on unmount
  useEffect(() => {
    return () => {
      wsService.disconnectChannel();
    };
  }, [wsService]);

  // Create context value with all required methods
  const contextValue = useMemo(
    () => ({
      state: {
        systemConnected,
        channelConnected,
      },
      actions: {
        connectSystem: (token: string) => wsService.connectSystem(token),
        connectChannel: (token: string, channelName: string) => wsService.connectChannel(token, channelName),
        disconnectChannel: () => wsService.disconnectChannel(),
        disconnectAll: () => wsService.disconnectAll(),
        send: (message: OutgoingMessage) => wsService.send(message),
        setMessageHandlers: (handlers: MessageHandlers) => wsService.setMessageHandlers(handlers),
      },
    }),
    [systemConnected, channelConnected, wsService]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
