import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChannelMessageHandler,
  SystemMessageHandler,
  WebSocketContext,
  WebSocketContextActions,
} from "../contexts/webSocketContext";
import { WebSocketService } from "../services/WebsocketService";
import { OutgoingMessage } from "../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  // State to hold connection status, managed by this provider
  const [isSystemConnected, setIsSystemConnected] = useState(false);
  const [isChannelConnected, setIsChannelConnected] = useState(false);

  // Store handlers in refs to avoid re-rendering provider when handlers change
  const systemHandlersRef = useRef<Map<string, SystemMessageHandler>>(new Map());
  const channelHandlersRef = useRef<Map<string, ChannelMessageHandler>>(new Map());

  // Memoize the singleton instance of the service
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  // Inject state setters and handler accessors into the WebSocketService instance
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[WebSocketProvider] Setting state setters and handler accessors in WebSocketService.");
    }
    wsService.setStateSetters({
      setSystemConnected: setIsSystemConnected,
      setChannelConnected: setIsChannelConnected,
    });
    // Provide functions to access the current handlers stored in refs
    wsService.setHandlerAccessors({
      getSystemHandlers: () => systemHandlersRef.current,
      getChannelHandlers: () => channelHandlersRef.current,
    });
  }, [wsService]); // Runs once

  // Mount/Unmount logging and cleanup
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[WebSocketProvider] Mounted.");
    }
    return () => {
      if (import.meta.env.DEV) {
        console.log("[WebSocketProvider] Unmounting WebSocketProvider, disconnecting all.");
      }
      wsService.disconnectAll();
    };
  }, [wsService]);

  // Define actions using useCallback for stability
  const actions = useMemo(
    (): WebSocketContextActions => ({
      connectSystem: (token: string) => {
        wsService.connectSystem(token);
      },
      connectChannel: (channelName: string, token: string) => {
        wsService.connectChannel(channelName, token);
      },
      disconnectChannel: () => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: disconnectChannel");
        wsService.disconnectChannel();
      },
      disconnectSystem: () => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: disconnectSystem");
        wsService.disconnectSystem();
      },
      send: (message: OutgoingMessage) => {
        wsService.send(message);
      },
      addSystemHandlers: (key: string, handlers: SystemMessageHandler) => {
        systemHandlersRef.current.set(key, handlers);
      },
      removeSystemHandlers: (key: string) => {
        systemHandlersRef.current.delete(key);
      },
      addChannelHandlers: (key: string, handlers: ChannelMessageHandler) => {
        channelHandlersRef.current.set(key, handlers);
      },
      removeChannelHandlers: (key: string) => {
        channelHandlersRef.current.delete(key);
      },
    }),
    [wsService]
  );

  // Create the context value
  const contextValue = useMemo(
    () => ({
      state: {
        systemConnected: isSystemConnected,
        channelConnected: isChannelConnected,
      },
      actions,
    }),
    [isSystemConnected, isChannelConnected, actions]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
