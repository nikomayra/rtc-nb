import { useEffect, useCallback, useMemo, useRef } from "react";
import { ChannelMemberSchema, IncomingMessage, MemberUpdateAction, MessageType } from "../types/interfaces";
import { ChannelMessageHandler } from "../contexts/webSocketContext";
import { useAuthContext } from "./useAuthContext";
import { useSystemContext } from "./useSystemContext";
import { useWebSocketContext } from "./useWebSocketContext";
import { useChannelContext } from "../hooks/useChannelContext";

const HANDLER_KEY = "channelSocket"; // Unique key for these handlers

export const useChannelSocket = () => {
  const websocketContext = useWebSocketContext();
  const systemContext = useSystemContext();
  const channelContext = useChannelContext();
  const {
    state: { token },
  } = useAuthContext();

  const { actions: channelActions } = channelContext;
  const { state: wsState, actions: wsActions } = websocketContext;
  const { channelConnected } = wsState;
  const { connectChannel, disconnectChannel, addChannelHandlers, removeChannelHandlers, send } = wsActions;

  const { state: systemState } = systemContext;
  const currentChannelName = systemState.currentChannel?.name;

  // --- Connection Effect ---
  useEffect(() => {
    if (currentChannelName && token) {
      connectChannel(token, currentChannelName);

      // Return cleanup function to disconnect on channel change or unmount
      return () => {
        disconnectChannel();
      };
    } else {
      // Ensure disconnection if no channel is selected
      disconnectChannel();
      return () => {};
    }
  }, [currentChannelName, token, connectChannel, disconnectChannel]);

  // --- Message Handlers ---
  const handleUserStatus = useCallback(
    (username: string, status: "online" | "offline") => {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Handler: User status update: ${username} is ${status}`);
      }
      channelActions.updateMemberOnlineStatus(username, status === "online");
    },
    [channelActions]
  );

  const handleChatMessage = useCallback(
    (message: IncomingMessage) => {
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Handler: Chat message received:", message);
      }
      // Add message only if it belongs to the currently viewed channel
      if (message.channelName === currentChannelName) {
        channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
      } else {
        if (import.meta.env.DEV) {
          console.warn(
            `[useChannelSocket] Handler: Received chat message for ${message.channelName} while in ${
              currentChannelName || "null"
            }. Ignoring.`
          );
        }
      }
    },
    [channelActions, currentChannelName]
  );

  const handleMemberUpdate = useCallback(
    (message: IncomingMessage) => {
      if (!message.content.memberUpdate || message.channelName !== currentChannelName) {
        if (import.meta.env.DEV && message.channelName !== currentChannelName) {
          console.warn(
            `[useChannelSocket] Handler: Received member update for ${message.channelName} while in ${
              currentChannelName || "null"
            }. Ignoring.`
          );
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Handler: Member update received:", message);
      }

      const { username, action, isAdmin } = message.content.memberUpdate!;

      switch (action) {
        case MemberUpdateAction.Added:
          channelActions.setMembers((prev) => {
            // Avoid adding duplicates
            if (prev.some((m) => m.username === username)) return prev;
            return [
              ...prev,
              {
                ...ChannelMemberSchema.parse({
                  // Parse to ensure structure
                  username: username,
                  isAdmin: isAdmin,
                  joinedAt: new Date().toISOString(), // Or use timestamp from message if available
                  lastMessage: null,
                }),
                isOnline: true, // Assume online on join
              },
            ];
          });
          // Also add the system message associated with the join
          channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
          break;
        case MemberUpdateAction.RoleChanged:
          channelActions.setMembers((prev) =>
            prev.map((member) => (member.username === username ? { ...member, isAdmin: isAdmin } : member))
          );
          // Also add the system message associated with role change
          channelActions.setMessages((prev: IncomingMessage[]) => [...prev, message]);
          break;
        default:
          console.warn(`[useChannelSocket] Handler: Unhandled member update action: ${action}`);
      }
    },
    [channelActions, currentChannelName]
  );

  // Memoize the handlers object based on the callback functions
  const handlers = useMemo<ChannelMessageHandler>(
    () => ({
      onUserStatus: handleUserStatus,
      onChatMessage: handleChatMessage,
      onMemberUpdate: handleMemberUpdate,
    }),
    [handleUserStatus, handleChatMessage, handleMemberUpdate]
  );

  // --- Handler Registration Effect ---
  const handlersRegisteredRef = useRef(false);
  useEffect(() => {
    // Determine if handlers should be registered based on channel selection
    const shouldRegisterHandlers = !!currentChannelName;

    if (shouldRegisterHandlers && !handlersRegisteredRef.current) {
      addChannelHandlers(HANDLER_KEY, handlers);
      handlersRegisteredRef.current = true;
    } else if (!shouldRegisterHandlers && handlersRegisteredRef.current) {
      removeChannelHandlers(HANDLER_KEY);
      handlersRegisteredRef.current = false;
    }

    // Cleanup handlers on unmount or if channel changes
    return () => {
      if (handlersRegisteredRef.current) {
        removeChannelHandlers(HANDLER_KEY);
        handlersRegisteredRef.current = false;
      }
    };
  }, [currentChannelName, addChannelHandlers, removeChannelHandlers, handlers]);

  // --- Send Actions ---
  const sendChatMessage = useCallback(
    (text: string) => {
      if (!currentChannelName) {
        console.warn("[useChannelSocket] sendChatMessage: No current channel selected.");
        return;
      }
      if (!channelConnected) {
        console.warn("[useChannelSocket] sendChatMessage: Channel socket not connected.");
        return;
      }
      send({
        type: MessageType.Text,
        channelName: currentChannelName,
        content: { text },
      });
    },
    [currentChannelName, send, channelConnected]
  );

  const sendImageMessage = useCallback(
    (message: string, fileUrl: string, thumbnailUrl: string) => {
      if (!currentChannelName) {
        console.warn("[useChannelSocket] sendImageMessage: No current channel selected.");
        return;
      }
      if (!channelConnected) {
        console.warn("[useChannelSocket] sendImageMessage: Channel socket not connected.");
        return;
      }
      send({
        type: MessageType.Image,
        channelName: currentChannelName,
        content: { text: message, fileUrl, thumbnailUrl },
      });
    },
    [currentChannelName, send, channelConnected]
  );

  const promoteMemberRole = useCallback(
    (username: string) => {
      if (!currentChannelName) {
        console.warn("[useChannelSocket] promoteMemberRole: No current channel selected.");
        return;
      }
      if (!channelConnected) {
        console.warn("[useChannelSocket] promoteMemberRole: Channel socket not connected.");
        return;
      }
      send({
        type: MessageType.MemberUpdate,
        channelName: currentChannelName,
        content: { memberUpdate: { username: username, action: MemberUpdateAction.RoleChanged, isAdmin: true } },
      });
    },
    [currentChannelName, send, channelConnected]
  );

  const demoteMemberRole = useCallback(
    (username: string) => {
      if (!currentChannelName) {
        console.warn("[useChannelSocket] demoteMemberRole: No current channel selected.");
        return;
      }
      if (!channelConnected) {
        console.warn("[useChannelSocket] demoteMemberRole: Channel socket not connected.");
        return;
      }
      send({
        type: MessageType.MemberUpdate,
        channelName: currentChannelName,
        content: { memberUpdate: { username: username, action: MemberUpdateAction.RoleChanged, isAdmin: false } },
      });
    },
    [currentChannelName, send, channelConnected]
  );

  return {
    channelConnected,
    sendChatMessage,
    sendImageMessage,
    promoteMemberRole,
    demoteMemberRole,
  };
};
