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

  const { actions: systemActions } = systemContext;
  const { setSystemHandlers, connectSystem } = websocketContext.actions;

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
          systemActions.setChannels((prev: Channel[]) => [...prev, channel]);
          break;
        case ChannelUpdateAction.Deleted:
          systemActions.setChannels((prev: Channel[]) => prev.filter((c: Channel) => c.name !== channel.name));
          if (systemContext.state.currentChannel?.name === channel.name) {
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

  useEffect(() => {
    if (!isLoggedIn) return;

    setSystemHandlers(handlers);

    return () => {
      setSystemHandlers({});
    };
  }, [isLoggedIn, handlers, setSystemHandlers]);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[useSystemSocket] Attempting to connect system socket");
    }
    connectSystem(token);
  }, [isLoggedIn, token, connectSystem]);

  return {
    // handled by backend for now...no uses...
  };
};
