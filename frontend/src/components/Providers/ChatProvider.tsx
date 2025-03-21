import { useCallback, useEffect, useState, useContext, useRef } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { AuthContext } from "../../contexts/authContext";
import {
  Channel,
  ChannelSchema,
  IncomingMessage,
  MessageType,
  IncomingMessageSchema,
  ChannelUpdateAction,
  MemberUpdateAction,
} from "../../types/interfaces";
import { BASE_URL } from "../../utils/constants";
import { axiosInstance } from "../../api/axiosInstance";
import { isAxiosError } from "axios";
import { z } from "zod";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { NotificationContext } from "../../contexts/notificationContext";
import React from "react";

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Record<string, IncomingMessage[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string | null>(() => {
    return sessionStorage.getItem("currentChannel");
  });

  const authContext = useContext(AuthContext);
  const wsContext = useContext(WebSocketContext);
  const notificationContext = useContext(NotificationContext);

  if (!authContext || !wsContext) {
    throw new Error("ChatProvider must be used within Auth and WebSocket providers");
  }

  const {
    state: { token, username },
  } = authContext;

  // Use a stable reference to notification functions
  const notifyError = useCallback(
    (message: string) => {
      if (!notificationContext) {
        console.error("Notification context not available:", message);
        return;
      }
      notificationContext.actions.addNotification({
        type: "error",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  const notifyInfo = useCallback(
    (message: string) => {
      if (!notificationContext) {
        console.error("Notification context not available:", message);
        return;
      }
      notificationContext.actions.addNotification({
        type: "info",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  const handleChannelUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type !== MessageType.ChannelUpdate || !message.content.channelUpdate) return;

      const update = message.content.channelUpdate;
      console.log("💬 Handling channel update:", update);

      // Normalize action for more reliable comparison
      const actionType = update.action.toLowerCase();

      if (actionType === ChannelUpdateAction.Created.toLowerCase()) {
        console.log("Processing channel creation for:", update.channel.name);
        setChannels((prev) => {
          // Check if channel with this name already exists
          const exists = prev.some((c) => c.name.toLowerCase() === update.channel.name.toLowerCase());
          if (exists) {
            console.log("Channel already exists, updating:", update.channel.name);
            // Replace the existing channel with the updated one
            return prev.map((c) => (c.name.toLowerCase() === update.channel.name.toLowerCase() ? update.channel : c));
          } else {
            console.log("Adding new channel:", update.channel.name);
            // Add the new channel
            return [...prev, update.channel];
          }
        });
      } else if (actionType === ChannelUpdateAction.Deleted.toLowerCase()) {
        setChannels((prev) => prev.filter((c) => c.name !== update.channel.name));
        if (currentChannel === update.channel.name) {
          setCurrentChannel(null);
        }
        // Also clear any messages for this channel
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages[update.channel.name];
          return newMessages;
        });
      }
    },
    [currentChannel]
  );

  const handleMessage = useCallback((message: IncomingMessage) => {
    if (message.type !== MessageType.Sketch) {
      console.log("📩 Processing message:", {
        type: message.type,
        channel: message.channelName,
      });
      setMessages((prev) => {
        if (prev[message.channelName]?.some((m) => m.id === message.id)) {
          console.log("⚠️ Duplicate message detected, skipping update");
          return prev;
        }
        const newMessages = {
          ...prev,
          [message.channelName]: [...(prev[message.channelName] || []), message],
        };
        console.log("Updated messages state:", newMessages);
        return newMessages;
      });
    }
  }, []);

  const fetchMessages = useCallback(
    async (channelName: string): Promise<void> => {
      if (!token) return;
      try {
        const res = await axiosInstance.get(`${BASE_URL}/getMessages/${encodeURIComponent(channelName)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const validatedMessages = z.array(IncomingMessageSchema).parse(res.data.data);
          setMessages((prev) => ({
            ...prev,
            [channelName]: validatedMessages,
          }));
        } else {
          const errorMsg = `Failed to get messages: ${res.data.error}`;
          console.error(errorMsg);
          notifyError(errorMsg);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMsg = "Invalid message data received";
          console.error("Invalid message data:", error.errors);
          notifyError(errorMsg);
        }
        if (isAxiosError(error)) {
          const errorMsg = `Failed to get messages: ${error.response?.data?.message || "Unknown error"}`;
          console.error(errorMsg);
          notifyError(errorMsg);
        }
        throw error;
      }
    },
    [token, notifyError]
  );

  // Fetch channels from the server on load or token change
  const fetchChannels = useCallback(async (): Promise<void> => {
    if (!token) return;

    try {
      const res = await axiosInstance.get(`${BASE_URL}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const validatedChannels = z.array(ChannelSchema).parse(res.data.data);

        // Ensure we don't duplicate channels with different case
        const uniqueChannels: Channel[] = [];
        const channelMap = new Map<string, boolean>();

        for (const channel of validatedChannels) {
          const normalizedName = channel.name.toLowerCase();
          if (!channelMap.has(normalizedName)) {
            channelMap.set(normalizedName, true);
            uniqueChannels.push(channel);
          } else {
            console.log(`Skipping duplicate channel: ${channel.name}`);
          }
        }

        setChannels(uniqueChannels);
        console.log(
          "Updated channels from fetchChannels:",
          uniqueChannels.map((c) => c.name)
        );
      } else {
        console.error("Failed to get channels:", res.data.error);
        notifyError(`Failed to get channels: ${res.data.error}`);
      }
    } catch (error: unknown) {
      let errorMsg = "Failed to get channels: Unknown error";

      if (error instanceof z.ZodError) {
        errorMsg = "Invalid channel data format";
        console.error("Invalid channel data:", error.errors);
      } else if (isAxiosError(error) && error.response?.data?.message) {
        errorMsg = `Failed to get channels: ${error.response.data.message}`;
      } else if (error instanceof Error) {
        errorMsg = `Failed to get channels: ${error.message}`;
      }

      console.error(errorMsg);
      notifyError(errorMsg);
      throw error;
    }
  }, [token, notifyError]);

  // System connection and channel list management - simplified
  useEffect(() => {
    if (!token) {
      wsContext.actions.disconnectAll();
      setChannels([]);
      setCurrentChannel(null);
      setMessages({});
      sessionStorage.removeItem("currentChannel");
      return;
    }

    // Connect to system websocket
    wsContext.actions.connectSystem(token);

    // Fetch channels whenever system connection is established
    if (wsContext.state.systemConnected) {
      fetchChannels().catch((error) => {
        if (error?.response?.status === 429) {
          console.warn("Rate limited when fetching channels");
        }
      });
    }
  }, [token, wsContext.state.systemConnected, wsContext.actions, fetchChannels]);

  // Channel connection and message management
  useEffect(() => {
    if (!token || !currentChannel) {
      wsContext.actions.disconnect();
      return;
    }

    // Connect to channel websocket
    wsContext.actions.connectChannel(token, currentChannel);
    sessionStorage.setItem("currentChannel", currentChannel);

    // Fetch messages when channel connection is established
    if (wsContext.state.channelConnected) {
      fetchMessages(currentChannel).catch(console.error);
    }
  }, [token, currentChannel, wsContext.state.channelConnected, wsContext.actions, fetchMessages]);

  const handleMemberUpdate = useCallback(
    (message: IncomingMessage) => {
      if (!message.content.memberUpdate) return;

      const update = message.content.memberUpdate;
      console.log("💬 Handling member update:", update, "action:", update.action);

      setChannels((prev) => {
        const result = prev.map((channel) => {
          if (channel.name === message.channelName) {
            // Make a clean copy of members
            const currentMembers = { ...channel.members };
            console.log("Current members before update:", currentMembers);

            // We'll use a consistent lowercase key for member lookup
            const memberLookupKey = update.username.toLowerCase();

            // Find the actual key in the members object (which might have different casing)
            const actualMemberKey = Object.keys(currentMembers).find((key) => key.toLowerCase() === memberLookupKey);

            switch (update.action) {
              case MemberUpdateAction.Added:
                // Always use the username as provided for the key to maintain consistency
                // This ensures the key and the username property match exactly
                currentMembers[update.username] = {
                  username: update.username,
                  isAdmin: update.isAdmin,
                  joinedAt: new Date().toISOString(),
                };
                break;

              case MemberUpdateAction.RoleChanged:
                if (actualMemberKey) {
                  // Update the member's admin status
                  currentMembers[actualMemberKey].isAdmin = update.isAdmin;
                } else {
                  console.error(
                    "Member not found for role change. Username:",
                    update.username,
                    "Available members:",
                    Object.keys(currentMembers).map((k) => `${k} (${currentMembers[k].username})`)
                  );
                }
                break;

              default:
                console.error("Unknown member update action:", update.action);
                break;
            }

            return {
              ...channel,
              members: currentMembers,
            };
          }
          return channel;
        });

        return result;
      });

      // Update the messages state
      handleMessage(message);
    },
    [handleMessage]
  );

  // Set the message handlers for the WebSocket
  // Add a ref to track if we've already logged the setup message
  const handlersLoggedRef = useRef(false);

  useEffect(() => {
    // Only log once per component mount, not on every dependency change
    if (!handlersLoggedRef.current) {
      console.log("🔄 Setting WebSocket message handlers");
      handlersLoggedRef.current = true;
    }

    wsContext.actions.setMessageHandlers({
      onChatMessage: handleMessage,
      onChannelUpdate: handleChannelUpdate,
      onMemberUpdate: handleMemberUpdate,
    });
  }, [wsContext, handleMessage, handleChannelUpdate, handleMemberUpdate]);

  const leaveChannel = useCallback(
    async (channelName: string): Promise<void> => {
      try {
        const res = await axiosInstance.patch(`${BASE_URL}/leavechannel/${encodeURIComponent(channelName)}`, null, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setCurrentChannel(null);
          notifyInfo(`Left channel: ${channelName}`);
        } else {
          const errorMsg = `Failed to leave channel: ${res.data.error}`;
          console.error(errorMsg);
          notifyError(errorMsg);
        }
      } catch (error) {
        if (isAxiosError(error)) {
          const errorMsg = `Failed to leave channel: ${error.response?.data?.message || "Unknown error"}`;
          console.error(errorMsg);
          notifyError(errorMsg);
        }
      }
    },
    [token, notifyError, notifyInfo]
  );

  const joinChannel = useCallback(
    async (channelName: string, password?: string): Promise<void> => {
      if (channelName === currentChannel) return;

      try {
        if (currentChannel) {
          await leaveChannel(currentChannel);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, 10000);

        try {
          const res = await axiosInstance.patch(
            `${BASE_URL}/joinchannel`,
            { name: channelName, password: password },
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
              timeout: 10000,
            }
          );

          clearTimeout(timeout);

          if (res.data.success) {
            setCurrentChannel(channelName);
            notifyInfo(`Joined channel: ${channelName}`);

            // Only broadcast member update if the user is not already a member
            const currChannel = channels.find((c) => c.name === channelName);
            const isAlreadyMember =
              currChannel && Object.values(currChannel.members).some((member) => member.username === username);

            if (!isAlreadyMember) {
              console.log("Broadcasting member joined update to system channel");
              wsContext.actions.send({
                type: MessageType.MemberUpdate,
                channelName,
                content: {
                  memberUpdate: {
                    action: MemberUpdateAction.Added,
                    username,
                    isAdmin: false,
                  },
                },
              });
            } else {
              console.log("User already a member, skipping member update broadcast");
            }
          } else {
            throw new Error(res.data.error || "Failed to join channel");
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Request timed out");
          }
          throw error;
        }
      } catch (error) {
        wsContext.actions.disconnect(); // Ensure disconnected on error
        if (isAxiosError(error)) {
          const errorMsg = `Failed to join channel: ${error instanceof Error ? error.message : "Unknown error"}`;
          console.error(errorMsg);
          notifyError(errorMsg);
        } else if (error instanceof Error) {
          notifyError(error.message);
        }
        throw error;
      }
    },
    [currentChannel, wsContext.actions, leaveChannel, token, username, channels, notifyError, notifyInfo]
  );

  const createChannel = async (channelName: string, description?: string, password?: string): Promise<void> => {
    try {
      const res = await axiosInstance.post(
        `${BASE_URL}/createchannel`,
        {
          name: channelName,
          description: description,
          password: password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const validatedChannel = ChannelSchema.parse(res.data.data);
        notifyInfo(`Channel "${channelName}" created successfully`);

        console.log("Sending channel creation websocket:", {
          type: MessageType.ChannelUpdate,
          channelName,
          content: {
            channelUpdate: {
              action: ChannelUpdateAction.Created,
              channel: validatedChannel,
            },
          },
        });

        // Update local state immediately in case the websocket message isn't received
        setChannels((prev) => {
          // Check if channel with this name already exists (case insensitive)
          const existingChannelIndex = prev.findIndex(
            (c) => c.name.toLowerCase() === validatedChannel.name.toLowerCase()
          );

          if (existingChannelIndex >= 0) {
            // Replace the existing channel
            console.log("Replacing existing channel in local state:", validatedChannel.name);
            const newChannels = [...prev];
            newChannels[existingChannelIndex] = validatedChannel;
            return newChannels;
          } else {
            // Add as a new channel
            console.log("Adding new channel to local state:", validatedChannel.name);
            return [...prev, validatedChannel];
          }
        });

        // Still send the websocket message for other clients
        wsContext.actions.send({
          type: MessageType.ChannelUpdate,
          channelName,
          content: {
            channelUpdate: {
              action: ChannelUpdateAction.Created,
              channel: validatedChannel,
            },
          },
        });
      } else {
        const errorMsg = `Failed to create channel: ${res.data.error}`;
        console.error(errorMsg);
        notifyError(errorMsg);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = "Invalid channel data received";
        console.error(errorMsg, error.errors);
        notifyError(errorMsg);
      }
      if (isAxiosError(error)) {
        const errorMsg = `Failed to create channel: ${error.response?.data?.message || "Unknown error"}`;
        console.error(errorMsg);
        notifyError(errorMsg);
      }
      throw error;
    }
  };

  const deleteChannel = async (channelName: string): Promise<void> => {
    try {
      const targetChannel = channels.find((c) => c.name === channelName);
      if (!targetChannel) return;

      const res = await axiosInstance.delete(`${BASE_URL}/deletechannel/${encodeURIComponent(channelName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        wsContext.actions.send({
          type: MessageType.ChannelUpdate,
          channelName: channelName,
          content: {
            channelUpdate: {
              action: ChannelUpdateAction.Deleted,
              channel: targetChannel,
            },
          },
        });
        notifyInfo(`Channel "${channelName}" deleted successfully`);
      } else {
        const errorMsg = `Failed to delete channel: ${res.data.error}`;
        console.error(errorMsg);
        notifyError(errorMsg);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg = `Failed to delete channel: ${error.response?.data?.message || "Unknown error"}`;
        console.error(errorMsg);
        notifyError(errorMsg);
      }
    }
  };

  return (
    <ChatContext.Provider
      value={{
        state: {
          messages,
          channels,
          currentChannel,
        },
        actions: {
          sendMessage: wsContext.actions.send,
          joinChannel,
          createChannel,
          deleteChannel,
          leaveChannel,
          getChannels: fetchChannels,
        },
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
