import { useEffect, useCallback, useRef } from "react";
import { ChannelUpdateAction, Channel, IncomingMessage, MessageType } from "../types/interfaces";
import { SystemMessageHandler } from "../contexts/webSocketContext";
import { useAuthContext } from "./useAuthContext";
import { useWebSocketContext } from "./useWebSocketContext";
import { useSystemContext } from "./useSystemContext";

export const useSystemSocket = () => {
  const { state: wsState, actions: wsActions } = useWebSocketContext();
  const { state: systemState, actions: systemActions } = useSystemContext();
  const { state: authState } = useAuthContext();

  const { systemConnected } = wsState;
  const { addSystemHandlers, removeSystemHandlers, connectSystem } = wsActions;

  // Ref to track if handlers are currently registered
  const handlersRegisteredRef = useRef(false);

  // Handler for system user status updates
  const handleSystemUserStatus = useCallback(
    (message: IncomingMessage) => {
      if (message.type === MessageType.SystemUserStatus && message.content.systemUserStatus) {
        const count = message.content.systemUserStatus.count;
        if (import.meta.env.DEV) {
          console.log("📊 [useSystemSocket] handler received count:", count);
        }
        systemActions.setOnlineUsersCount(count);
      } else {
        console.warn("[useSystemSocket] Received non-SystemUserStatus message in status handler:", message);
      }
    },
    [systemActions]
  );

  // Handler for channel updates
  const handleChannelUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type === MessageType.ChannelUpdate && message.content.channelUpdate) {
        const { action, channel } = message.content.channelUpdate;
        if (import.meta.env.DEV) {
          console.log("[useSystemSocket] Received channel update", action, channel);
        }
        switch (action) {
          case ChannelUpdateAction.Created:
            systemActions.setChannels((prev: Channel[]) => {
              if (!prev.some((c) => c.name === channel.name)) {
                return [...prev, channel];
              }
              return prev;
            });
            break;
          case ChannelUpdateAction.Deleted:
            systemActions.setChannels((prev: Channel[]) => prev.filter((c: Channel) => c.name !== channel.name));
            if (systemState.currentChannel?.name === channel.name) {
              if (import.meta.env.DEV) {
                console.log(
                  `[useSystemSocket] Current channel ${channel.name} was deleted. Resetting current channel.`
                );
              }
              systemActions.setCurrentChannel(null);
            }
            break;
          default:
            console.warn(`[useSystemSocket] Unhandled channel update action: ${action}`);
        }
      } else {
        console.warn("[useSystemSocket] Received non-ChannelUpdate message in channel handler:", message);
      }
    },
    [systemActions, systemState.currentChannel]
  );

  // --- Effect to Register/Unregister WebSocket Handlers --- //
  useEffect(() => {
    const handlerKey = "systemSocketHandlers";

    const handlers: SystemMessageHandler = {
      onSystemUserStatus: handleSystemUserStatus,
      onChannelUpdate: handleChannelUpdate,
    };

    if (authState.isLoggedIn && !handlersRegisteredRef.current) {
      addSystemHandlers(handlerKey, handlers);
      handlersRegisteredRef.current = true;
    } else if (!authState.isLoggedIn && handlersRegisteredRef.current) {
      removeSystemHandlers(handlerKey);
      handlersRegisteredRef.current = false;
    }

    // Cleanup on unmount or if login status changes *while* registered
    return () => {
      if (handlersRegisteredRef.current) {
        removeSystemHandlers(handlerKey);
        handlersRegisteredRef.current = false;
      }
    };
  }, [authState.isLoggedIn, addSystemHandlers, removeSystemHandlers, handleSystemUserStatus, handleChannelUpdate]);

  // --- Effect to Initiate System Connection --- // (Mostly unchanged)
  useEffect(() => {
    if (authState.isLoggedIn && authState.token) {
      connectSystem(authState.token);
    }
  }, [authState.isLoggedIn, authState.token, connectSystem]);

  return {
    systemConnected,
  };
};
