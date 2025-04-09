import { useEffect, useCallback, useMemo } from "react";
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
  // Destructure state and actions from WebSocket context
  const { state: wsState, actions: wsActions } = websocketContext;
  const { channelConnected } = wsState; // Get connection state
  const { send, addChannelHandlers, removeChannelHandlers, connectChannel, disconnectChannel } = wsActions;

  const { state: systemState } = systemContext;
  const currentChannelName = systemState.currentChannel?.name;

  // --- Connection Effect ---
  useEffect(() => {
    // Guard: Only proceed if logged in and a channel is selected
    if (token && currentChannelName) {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Effect: Attempting connect to channel: ${currentChannelName}`);
      }
      // connectChannel is idempotent and handles internal state checking
      connectChannel(token, currentChannelName);

      // Cleanup function: Disconnect when channel changes or component unmounts
      return () => {
        if (import.meta.env.DEV) {
          console.log(`[useChannelSocket] Effect Cleanup: Disconnecting from channel: ${currentChannelName}`);
        }
        // disconnectChannel handles clearing timeouts and internal state
        disconnectChannel();
      };
    } else {
      // If no channel is selected, ensure disconnect is called (e.g., switching from a channel to null)
      // Note: disconnectChannel handles the case where there's nothing to disconnect.
      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Effect Cleanup: No channel selected, ensuring disconnect.");
      }
      disconnectChannel();
      return undefined; // Explicitly return undefined for clarity
    }
    // Dependencies: Effect should re-run if token or channel name changes.
    // connectChannel/disconnectChannel functions are stable references from context.
  }, [token, currentChannelName, connectChannel, disconnectChannel]);

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
            `[useChannelSocket] Handler: Received chat message for ${message.channelName} while in ${currentChannelName}. Ignoring.`
          );
        }
      }
    },
    [channelActions, currentChannelName] // Add currentChannelName dependency
  );

  const handleMemberUpdate = useCallback(
    (message: IncomingMessage) => {
      if (!message.content.memberUpdate || message.channelName !== currentChannelName) {
        if (import.meta.env.DEV && message.channelName !== currentChannelName) {
          console.warn(
            `[useChannelSocket] Handler: Received member update for ${message.channelName} while in ${currentChannelName}. Ignoring.`
          );
        }
        return; // Ignore if no data or wrong channel
      }

      if (import.meta.env.DEV) {
        console.log("[useChannelSocket] Handler: Member update received:", message);
      }

      const { username, action, isAdmin } = message.content.memberUpdate!; // Use non-null assertion after guard

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
        case MemberUpdateAction.Removed:
          channelActions.setMembers((prev) => prev.filter((m) => m.username !== username));
          // Also add the system message associated with leaving
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
  useEffect(() => {
    // If a channel is selected, register the handlers.
    if (currentChannelName) {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Effect: Adding channel handlers for key: ${HANDLER_KEY}`);
      }
      addChannelHandlers(HANDLER_KEY, handlers);
    } else {
      // If no channel is selected, ensure handlers are cleared.
      if (import.meta.env.DEV) {
        console.log(
          `[useChannelSocket] Effect: Removing channel handlers for key: ${HANDLER_KEY} (no channel selected).`
        );
      }
      removeChannelHandlers(HANDLER_KEY);
    }

    // Cleanup: Clear handlers when the channel changes or the hook unmounts.
    return () => {
      if (import.meta.env.DEV) {
        console.log(`[useChannelSocket] Effect Cleanup: Removing channel handlers for key: ${HANDLER_KEY}`);
      }
      removeChannelHandlers(HANDLER_KEY);
    };
    // This effect depends on the selected channel name and the memoized handlers object.
  }, [currentChannelName, handlers, addChannelHandlers, removeChannelHandlers]);

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

  // Return connection state and actions
  return {
    channelConnected,
    sendChatMessage,
    sendImageMessage,
    promoteMemberRole,
    demoteMemberRole,
  };
};
