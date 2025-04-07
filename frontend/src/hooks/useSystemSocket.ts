import { useEffect, useCallback, useMemo } from "react";
import { ChannelUpdateAction, Channel } from "../types/interfaces";
import { SystemMessageHandler } from "../contexts/webSocketContext";
import { useAuthContext } from "./useAuthContext";
import { useWebSocketContext } from "./useWebSocketContext";
import { useSystemContext } from "./useSystemContext";

export const useSystemSocket = () => {
  const websocketContext = useWebSocketContext();
  const systemContext = useSystemContext();
  const {
    state: { isLoggedIn, token },
  } = useAuthContext();

  // Destructure state and actions from WebSocket context
  const { state: wsState, actions: wsActions } = websocketContext;
  const { systemConnected } = wsState; // Get connection state
  const { setSystemHandlers, connectSystem } = wsActions;

  const { actions: systemActions } = systemContext;

  const handleSystemUserStatus = useCallback(
    (count: number) => {
      if (import.meta.env.DEV) {
        console.log("📊 [useSystemSocket] handler received count:", count);
      }
      systemActions.setOnlineUsersCount(count);
    },
    [systemActions]
  );

  const handleChannelUpdate = useCallback(
    (action: ChannelUpdateAction | string, channel: Channel) => {
      if (import.meta.env.DEV) {
        console.log("[useSystemSocket] Received channel update", action, channel);
      }
      switch (action) {
        case ChannelUpdateAction.Created:
          // Avoid duplicates if already present (though backend should ideally handle this)
          systemActions.setChannels((prev: Channel[]) => {
            if (!prev.some((c) => c.name === channel.name)) {
              return [...prev, channel];
            }
            return prev;
          });
          break;
        case ChannelUpdateAction.Deleted:
          systemActions.setChannels((prev: Channel[]) => prev.filter((c: Channel) => c.name !== channel.name));
          // If the deleted channel is the current one, reset current channel
          if (systemContext.state.currentChannel?.name === channel.name) {
            if (import.meta.env.DEV) {
              console.log(`[useSystemSocket] Current channel ${channel.name} was deleted. Resetting current channel.`);
            }
            systemActions.setCurrentChannel(null);
          }
          break;
        default:
          console.warn(`[useSystemSocket] Unhandled channel update action: ${action}`);
      }
    },
    [systemActions, systemContext.state.currentChannel]
  );

  const handlers = useMemo<SystemMessageHandler>(
    () => ({
      onSystemUserStatus: handleSystemUserStatus,
      onChannelUpdate: handleChannelUpdate,
    }),
    [handleSystemUserStatus, handleChannelUpdate]
  );

  // Effect to set/clear handlers based on login status
  useEffect(() => {
    if (isLoggedIn) {
      if (import.meta.env.DEV) console.log("[useSystemSocket] Setting system handlers.");
      setSystemHandlers(handlers);
    } else {
      // Clear handlers if not logged in
      if (import.meta.env.DEV) console.log("[useSystemSocket] Clearing system handlers (not logged in).");
      setSystemHandlers({});
    }

    // Cleanup function: clear handlers when the hook unmounts or dependencies change
    return () => {
      if (import.meta.env.DEV) console.log("[useSystemSocket] Cleaning up system handlers.");
      setSystemHandlers({});
    };
  }, [isLoggedIn, handlers, setSystemHandlers]);

  // Effect to initiate system connection
  useEffect(() => {
    // Only attempt connection if logged in, have a token, and handlers are set (implicitly via isLoggedIn check above)
    if (isLoggedIn && token) {
      // Note: connectSystem itself is idempotent and checks internally if already connected/connecting
      if (import.meta.env.DEV) {
        console.log("[useSystemSocket] Attempting system socket connection (if needed)...");
      }
      connectSystem(token);
    }
    // We don't need a cleanup here to disconnect the *system* socket usually,
    // as it should persist while logged in. disconnectAll in the provider handles final cleanup.
  }, [isLoggedIn, token, connectSystem]); // Dependencies ensure this runs if login state or token changes

  // Return the connection state for potential use in components
  return {
    systemConnected,
  };
};
