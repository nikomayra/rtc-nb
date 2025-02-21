import { useCallback, useEffect, useState, useContext } from "react";
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

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Record<string, IncomingMessage[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string | null>(() => {
    return sessionStorage.getItem("currentChannel");
  });

  const authContext = useContext(AuthContext);
  const wsContext = useContext(WebSocketContext);

  if (!authContext || !wsContext) {
    throw new Error("ChatProvider must be used within Auth and WebSocket providers");
  }

  const {
    state: { token, username },
  } = authContext;

  const handleChannelUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type !== MessageType.ChannelUpdate || !message.content.channelUpdate) return;

      const update = message.content.channelUpdate;
      switch (update.action) {
        case ChannelUpdateAction.Created:
          setChannels((prev) => [...prev, update.channel]);
          break;
        case ChannelUpdateAction.Deleted:
          setChannels((prev) => prev.filter((c) => c.name !== update.channel.name));
          if (currentChannel === update.channel.name) {
            setCurrentChannel(null);
          }
          break;
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
          console.error("Failed to get messages:", res.data.error);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error("Invalid message data:", error.errors);
        }
        if (isAxiosError(error)) {
          console.error("Failed to get messages:", error.response?.data?.message);
        }
        throw error;
      }
    },
    [token]
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
        setChannels(validatedChannels);
      } else {
        console.error("Failed to get channels:", res.data.error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Invalid channel data:", error.errors);
      }
      if (isAxiosError(error)) {
        console.error("Failed to get channels:", error.response?.data?.message);
      }
      throw error;
    }
  }, [token]);

  // System connection and channel list management
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
      setChannels((prev) =>
        prev.map((channel) => {
          if (channel.name === message.channelName) {
            const updatedMembers = { ...channel.members };

            switch (update.action) {
              case MemberUpdateAction.Added:
                updatedMembers[update.username] = {
                  username: update.username,
                  isAdmin: update.isAdmin,
                  joinedAt: new Date().toISOString(),
                };
                break;
              case MemberUpdateAction.RoleChanged:
                if (updatedMembers[update.username]) {
                  updatedMembers[update.username].isAdmin = update.isAdmin;
                }
                break;
            }

            return {
              ...channel,
              members: updatedMembers,
            };
          }
          return channel;
        })
      );
      // Update the messages state
      handleMessage(message);
    },
    [handleMessage]
  );

  // Set the message handlers for the WebSocket
  useEffect(() => {
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
        } else {
          console.error("Failed to leave channel:", res.data.error);
        }
      } catch (error) {
        if (isAxiosError(error)) {
          console.error("Failed to leave channel:", error.response?.data?.message);
        }
      }
    },
    [token]
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
            // Only send a member update if the user is not already a member
            const currChannel = channels.find((c) => c.name === channelName);
            if (currChannel && Object.values(currChannel.members).some((member) => member.username === username)) {
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
          console.error("Failed to join channel:", error.response?.data?.message);
        }
        throw error;
      }
    },
    [currentChannel, wsContext.actions, leaveChannel, token, channels, username]
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
        wsContext.actions.send({
          type: MessageType.ChannelUpdate,
          channelName: channelName,
          content: {
            channelUpdate: {
              action: ChannelUpdateAction.Created,
              channel: validatedChannel,
            },
          },
        });
      } else {
        console.error("Failed to create channel:", res.data.error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Invalid channel data:", error.errors);
      }
      if (isAxiosError(error)) {
        console.error("Failed to create channel:", error.response?.data?.message);
      }
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
      } else {
        console.error("Failed to delete channel:", res.data.error);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.error("Failed to delete channel:", error.response?.data?.message);
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
