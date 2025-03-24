import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketContext, MessageHandlers, WebSocketContextType } from "../../contexts/webSocketContext";
import { WebSocketService } from "../../services/WebsocketService";
import { OutgoingMessage } from "../../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [systemConnected, setSystemConnected] = useState(false);
  const [channelConnected, setChannelConnected] = useState(false);

  // Create refs to track the actual state values
  const systemConnectedRef = useRef(false);
  const channelConnectedRef = useRef(false);

  // Get the singleton instance
  const wsService = WebSocketService.getInstance();

  // Manual update method to ensure synchronous updates
  const updateState = useCallback(() => {
    const newSystemConnected = wsService.isSystemConnected;
    const newChannelConnected = wsService.isChannelConnected;

    // Only update React state if values have changed
    if (systemConnectedRef.current !== newSystemConnected) {
      console.log(`System connection state changed: ${newSystemConnected} (manual check)`);
      systemConnectedRef.current = newSystemConnected;
      setSystemConnected(newSystemConnected);
    }

    if (channelConnectedRef.current !== newChannelConnected) {
      console.log(`Channel connection state changed: ${newChannelConnected} (manual check)`);
      channelConnectedRef.current = newChannelConnected;
      setChannelConnected(newChannelConnected);
    }
  }, [wsService]);

  // Set up connection state callback handlers
  const handleSystemConnectionChange = useCallback((connected: boolean) => {
    console.log(`System connection state changed: ${connected} (direct callback)`);
    systemConnectedRef.current = connected;
    setSystemConnected(connected);
  }, []);

  const handleChannelConnectionChange = useCallback((connected: boolean) => {
    console.log(`Channel connection state changed: ${connected} (direct callback)`);
    channelConnectedRef.current = connected;
    setChannelConnected(connected);
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

    // Set up a fast polling interval to ensure state consistency
    const fastInterval = setInterval(updateState, 100);

    return () => {
      // Clear callbacks on unmount
      wsService.setConnectionStateCallbacks({});
      clearInterval(fastInterval);
    };
  }, [handleSystemConnectionChange, handleChannelConnectionChange, wsService, updateState]);

  // Clean up websocket connections on unmount
  useEffect(() => {
    return () => {
      wsService.disconnectChannel();
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
      disconnectChannel: () => wsService.disconnectChannel(),
      disconnectAll: () => wsService.disconnectAll(),
      send: (message: OutgoingMessage) => wsService.send(message),
      setMessageHandlers: (handlers: MessageHandlers) => wsService.setMessageHandlers(handlers),
    },
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
