import { useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { ChatContext } from '../../contexts/chatContext';
import { WebSocketService } from '../../services/WebsocketService';
import { AuthContext } from '../../contexts/authContext';
import { Channel, ChannelSchema, IncomingMessage, OutgoingMessage } from '../../types/interfaces';
import { BASE_URL } from '../../utils/constants';
import axiosInstance from '../../api/axiosInstance';
import { isAxiosError } from 'axios';
import { z } from 'zod';

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  const [messages, setMessages] = useState<Record<string, IncomingMessage[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = context.state.token;
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  useEffect(() => {
    if (!token || !currentChannel) {
      wsService.disconnect();
      return;
    }

    const callbacks = {
      onMessage: (message: IncomingMessage) => {
        setMessages((prev) => ({
          ...prev,
          [message.channelName]: [...(prev[message.channelName] || []), message],
        }));
      },
      onConnectionChange: setIsConnected,
    };

    wsService.setCallbacks(callbacks);
    wsService.connect(token, currentChannel || '');

    return () => {
      wsService.setCallbacks({
        onMessage: () => {},
        onConnectionChange: () => {},
      });
      wsService.disconnect();
    };
  }, [token, wsService, currentChannel]);

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
        console.error('Failed to get channels:', res.data.error);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid channel data:', error.errors);
      }
      if (isAxiosError(error)) {
        console.error('Failed to get channels:', error.response?.data?.message);
      }
      throw error;
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchChannels();
    }
  }, [token, fetchChannels]);

  const actions = {
    sendMessage: async (message: OutgoingMessage): Promise<void> => {
      if (!token) return;
      wsService.send(message);
    },
    joinChannel: async (channelName: string, password?: string): Promise<void> => {
      try {
        const res = await axiosInstance.patch(
          `${BASE_URL}/joinchannel`,
          { channelName, channelPassword: password },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          setCurrentChannel(channelName);
          wsService.disconnect();
          wsService.connect(token!, channelName);
        }
      } catch (error) {
        if (isAxiosError(error)) {
          console.error('Failed to join channel:', error.response?.data?.message);
        }
        throw error;
      }
    },
    createChannel: async (
      channelName: string,
      description?: string,
      password?: string
    ): Promise<void> => {
      try {
        const res = await axiosInstance.post(
          `${BASE_URL}/createchannel`,
          {
            channelName: channelName,
            channelDescription: description,
            channelPassword: password,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          const validatedChannel = ChannelSchema.parse(res.data.data);
          setChannels((prev) => [...prev, validatedChannel]);
        } else {
          console.error('Failed to create channel:', res.data.error);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Invalid channel data:', error.errors);
        }
        if (isAxiosError(error)) {
          console.error('Failed to create channel:', error.response?.data?.message);
        }
      }
    },
    deleteChannel: async (channelName: string): Promise<void> => {
      try {
        const res = await axiosInstance.delete(
          `${BASE_URL}/deletechannel/${encodeURIComponent(channelName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          setChannels((prev) => prev.filter((channel) => channel.name !== channelName));
          setCurrentChannel(null);
        } else {
          console.error('Failed to delete channel:', res.data.error);
        }
      } catch (error) {
        if (isAxiosError(error)) {
          console.error('Failed to delete channel:', error.response?.data?.message);
        }
      }
    },
    leaveChannel: async (channelName: string): Promise<void> => {
      try {
        const res = await axiosInstance.patch(
          `${BASE_URL}/leavechannel/${encodeURIComponent(channelName)}`,
          null,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          setCurrentChannel(null);
        } else {
          console.error('Failed to leave channel:', res.data.error);
        }
      } catch (error) {
        if (isAxiosError(error)) {
          console.error('Failed to leave channel:', error.response?.data?.message);
        }
      }
    },
    getChannels: fetchChannels,
  };

  return (
    <ChatContext.Provider
      value={{
        state: {
          messages,
          channels,
          currentChannel,
          isConnected,
        },
        actions,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
