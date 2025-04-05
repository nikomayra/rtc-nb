import { useEffect, useCallback, useMemo } from "react";
import { ChannelMemberSchema, IncomingMessage, MemberUpdateAction, MessageType } from "../types/interfaces";
import { ChannelMessageHandler } from "../contexts/webSocketContext";
import { useAuthContext } from "./useAuthContext";
import { useSystemContext } from "./useSystemContext";
import { useWebSocketContext } from "./useWebSocketContext";
import { useChannelContext } from "../hooks/useChannelContext";

export const useChannelSocket = () => {
  const websocketContext = useWebSocketContext();
  const systemContext = useSystemContext();
  const channelContext = useChannelContext();
  const {
    state: { token },
  } = useAuthContext();

  const { actions: channelActions } = channelContext;
  const { actions: websocketActions } = websocketContext;
  const { state: systemState } = systemContext;
  const { send, setChannelHandlers, connectChannel, disconnectChannel } = websocketActions;
  const currentChannelName = systemState.currentChannel?.name;

  // Effect to CONNECT to the channel when conditions are met
  useEffect(() => {
    // Connect only if logged in, have a token, and a channel is selected
    if (token && currentChannelName) {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Attempting to connect to channel: ${currentChannelName}`);
      }
      connectChannel(token, currentChannelName);

      // Return the cleanup function ONLY if a connection was attempted
      return () => {
        if (import.meta.env.DEV) {
          console.log(
            `[useChannelSocket] Cleaning up connection for channel (via effect cleanup): ${currentChannelName}`
          );
        }
        disconnectChannel();
      };
    }
    // No cleanup function is returned if token/currentChannelName are missing
    return undefined;
  }, [token, currentChannelName, connectChannel, disconnectChannel]);

  // Memoize handlers
  const handleUserStatus = useCallback(
    (username: string, status: "online" | "offline") => {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Received user status update: ${username} is ${status}`);
      }
      channelActions.updateMemberOnlineStatus(username, status === "online");
    },
    [channelActions]
  );

  const handleChatMessage = useCallback(
    (message: IncomingMessage) => {
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Received chat message:", message);
      }
      channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
    },
    [channelActions]
  );

  const handleMemberUpdate = useCallback(
    (message: IncomingMessage) => {
      if (!message.content.memberUpdate) return;
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Received member update:", message);
      }
      switch (message.content.memberUpdate.action) {
        case MemberUpdateAction.Added:
          channelActions.setMembers((prev) => [
            ...prev,
            {
              ...ChannelMemberSchema.parse({
                username: message.content.memberUpdate!.username,
                isAdmin: message.content.memberUpdate!.isAdmin,
                joinedAt: new Date().toISOString(),
                lastMessage: null,
              }),
              isOnline: true, // Assume online on join
            },
          ]);
          channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
          break;
        case MemberUpdateAction.RoleChanged:
          channelActions.setMembers((prev) =>
            prev.map((member) =>
              member.username === message.content.memberUpdate!.username
                ? { ...member, isAdmin: message.content.memberUpdate!.isAdmin }
                : member
            )
          );
          channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
          break;
        default:
          console.warn(`[useChannelSocket] Unhandled member update action: ${message.content.memberUpdate?.action}`);
      }
    },
    [channelActions]
  );

  const handlers = useMemo<ChannelMessageHandler>(
    () => ({
      onUserStatus: handleUserStatus,
      onChatMessage: handleChatMessage,
      onMemberUpdate: handleMemberUpdate,
    }),
    [handleUserStatus, handleChatMessage, handleMemberUpdate]
  );

  // Effect to SET/CLEAR message handlers based on channel selection
  useEffect(() => {
    // If a channel is selected, set the handlers in the service.
    // The service itself ensures messages are only processed when connected.
    if (currentChannelName) {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Setting channel handlers for: ${currentChannelName}`);
      }
      setChannelHandlers(handlers);
    } else {
      // If no channel is selected, clear the handlers.
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Clearing channel handlers (no channel selected)");
      }
      setChannelHandlers({});
    }

    // Cleanup: Ensure handlers are cleared when the component unmounts
    // or if the channel name becomes null/undefined for any reason.
    return () => {
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Cleaning up channel handlers on effect cleanup");
      }
      setChannelHandlers({});
    };
    // Depend only on the channel name and the stable handlers object.
    // No longer depend on websocketState.channelConnected here.
  }, [currentChannelName, handlers, setChannelHandlers]);

  // SENDING MESSAGES
  const sendChatMessage = useCallback(
    (text: string) => {
      if (!currentChannelName) return;

      send({
        type: MessageType.Text,
        channelName: currentChannelName,
        content: { text },
      });
    },
    [currentChannelName, send]
  );

  const sendImageMessage = useCallback(
    (message: string, fileUrl: string, thumbnailUrl: string) => {
      if (!currentChannelName) return;

      send({
        type: MessageType.Image,
        channelName: currentChannelName,
        content: { text: message, fileUrl, thumbnailUrl },
      });
    },
    [currentChannelName, send]
  );

  const promoteMemberRole = useCallback(
    (username: string) => {
      if (!currentChannelName) return;

      send({
        type: MessageType.MemberUpdate,
        channelName: currentChannelName,
        content: { memberUpdate: { username: username, action: MemberUpdateAction.RoleChanged, isAdmin: true } },
      });
    },
    [currentChannelName, send]
  );

  const demoteMemberRole = useCallback(
    (username: string) => {
      if (!currentChannelName) return;

      send({
        type: MessageType.MemberUpdate,
        channelName: currentChannelName,
        content: { memberUpdate: { username: username, action: MemberUpdateAction.RoleChanged, isAdmin: false } },
      });
    },
    [currentChannelName, send]
  );

  // No state here! Just actions
  return {
    sendChatMessage,
    sendImageMessage,
    promoteMemberRole,
    demoteMemberRole,
  };
};
