import React, { useState, useEffect, useMemo } from "react";
import { ChannelMessageHandler, SystemMessageHandler, WebSocketContext } from "../contexts/webSocketContext";
import { WebSocketService } from "../services/WebsocketService";
import { OutgoingMessage } from "../types/interfaces";

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  // State to hold connection status, managed by this provider
  const [isSystemConnected, setIsSystemConnected] = useState(false);
  const [isChannelConnected, setIsChannelConnected] = useState(false);

  // Memoize the singleton instance of the service
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  // Inject state setters into the WebSocketService instance once on mount
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[WebSocketProvider] Setting state setters in WebSocketService.");
    }
    // Pass the state setter functions to the service
    wsService.setStateSetters({
      setSystemConnected: setIsSystemConnected,
      setChannelConnected: setIsChannelConnected,
    });

    // Optional: Clear setters on unmount? Not strictly necessary for singleton, but good practice.
    // return () => {
    //   wsService.setStateSetters({
    //      setSystemConnected: () => {}, // No-op functions
    //      setChannelConnected: () => {},
    //    });
    // };
  }, [wsService]); // Dependency array ensures this runs only once

  // Mount/Unmount logging and cleanup
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[WebSocketProvider] Mounted.");
    }
    // Cleanup function: Disconnect all sockets when the provider unmounts
    return () => {
      if (import.meta.env.DEV) {
        console.log("[WebSocketProvider] Unmounting WebSocketProvider, disconnecting all.");
      }
      wsService.disconnectAll();
    };
  }, [wsService]); // Run only on mount and unmount

  // Memoize the actions object
  const actions = useMemo(
    () => ({
      connectSystem: (token: string) => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: connectSystem");
        wsService.connectSystem(token);
      },
      connectChannel: (token: string, channelName: string) => {
        if (import.meta.env.DEV) console.log(`[WebSocketProvider] Action: connectChannel to ${channelName}`);
        wsService.connectChannel(token, channelName);
      },
      disconnectChannel: () => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: disconnectChannel");
        wsService.disconnectChannel(); // Pass explicit reason if desired, e.g., "User action"
      },
      disconnectAll: () => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: disconnectAll");
        wsService.disconnectAll();
      },
      send: (message: OutgoingMessage) => {
        // No need to log every send action here, service does it
        wsService.send(message);
      },
      // Pass handler setters directly
      setSystemHandlers: (handlers: SystemMessageHandler) => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: setSystemHandlers");
        wsService.setSystemHandlers(handlers);
      },
      setChannelHandlers: (handlers: ChannelMessageHandler) => {
        if (import.meta.env.DEV) console.log("[WebSocketProvider] Action: setChannelHandlers");
        wsService.setChannelHandlers(handlers);
      },
    }),
    [wsService] // wsService is stable due to useMemo(() => getInstance(), [])
  );

  // Create the context value, memoized based on connection state and actions
  const contextValue = useMemo(
    () => ({
      state: {
        // Match the expected context type shape
        systemConnected: isSystemConnected,
        channelConnected: isChannelConnected,
      },
      actions,
    }),
    // Dependency array includes the state variables that determine the context value
    [isSystemConnected, isChannelConnected, actions]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
};
