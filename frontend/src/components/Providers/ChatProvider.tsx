import { useCallback, useEffect, useState, useContext } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { AuthContext } from "../../contexts/authContext";
import { Channel, ChannelSchema, IncomingMessage, MessageType, IncomingMessageSchema } from "../../types/interfaces";
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
    state: { token },
  } = authContext;

  const handleMessage = useCallback((message: IncomingMessage) => {
    if (message.type !== MessageType.SketchUpdate) {
      console.log("💬 Received chat message:", message);
      setMessages((prev) => {
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

  // Set the message handler for the WebSocket
  useEffect(() => {
    wsContext.actions.setMessageHandlers({
      onChatMessage: handleMessage,
    });
  }, [wsContext, handleMessage]);

  // Connect to the WebSocket when the token and currentChannel are available
  useEffect(() => {
    if (token && currentChannel) {
      wsContext.actions.connect(token, currentChannel);
      sessionStorage.setItem("currentChannel", currentChannel);
      fetchMessages(currentChannel);
    } else {
      wsContext.actions.disconnect();
      // sessionStorage.removeItem("currentChannel");
    }
  }, [token, wsContext, currentChannel, fetchMessages]);

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

  // Fetch channels on load and token change
  useEffect(() => {
    if (token) {
      fetchChannels();
    } else {
      setChannels([]);
      setCurrentChannel(null);
      sessionStorage.removeItem("currentChannel");
    }
  }, [token, fetchChannels]);

  // Reconnect to current channel if connection is lost
  useEffect(() => {
    if (!wsContext.state.isConnected && token && currentChannel) {
      const reconnectTimer = setTimeout(() => {
        wsContext.actions.connect(token, currentChannel);
      }, 3000);
      return () => clearTimeout(reconnectTimer);
    }
  }, [wsContext.state.isConnected, token, currentChannel, wsContext]);

  // const sendMessage = async (message: OutgoingMessage): Promise<void> => {
  //   if (!token) return;
  //   wsContext.actions.send(message);
  // };

  const joinChannel = async (channelName: string, password?: string): Promise<void> => {
    if (channelName === currentChannel) return;
    try {
      const res = await axiosInstance.patch(
        `${BASE_URL}/joinchannel`,
        { name: channelName, password: password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        wsContext.actions.disconnect();
        setCurrentChannel(channelName);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.error("Failed to join channel:", error.response?.data?.message);
      }
      throw error;
    }
  };

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
        setChannels((prev) => [...prev, validatedChannel]);
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
      const res = await axiosInstance.delete(`${BASE_URL}/deletechannel/${encodeURIComponent(channelName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setChannels((prev) => prev.filter((channel) => channel.name !== channelName));
        if (currentChannel === channelName) {
          setCurrentChannel(null);
        }
      } else {
        console.error("Failed to delete channel:", res.data.error);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        console.error("Failed to delete channel:", error.response?.data?.message);
      }
    }
  };

  const leaveChannel = async (channelName: string): Promise<void> => {
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
