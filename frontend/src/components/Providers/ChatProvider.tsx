import { useEffect, useReducer, useMemo } from 'react';
import { ChatContext } from '../../contexts/chatContext';
import { WebSocketService } from '../../services/WebsocketService';
import { useAuthContext } from '../../hooks/useAuthContext';
import {
  APIResponse,
  Channel,
  ChannelSchema,
  IncomingMessage,
  OutgoingMessage,
} from '../../types/interfaces';
import { BASE_URL } from '../../utils/constants';
import axiosInstance from '../../api/axiosInstance';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { ChatAction } from '../../types/chatTypes';
import { ChatState } from '../../types/chatTypes';

const initialState: ChatState = {
  channels: [],
  currentChannel: null,
  messages: {},
  isConnected: false,
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_CHANNELS':
      return { ...state, channels: action.payload };

    case 'ADD_CHANNEL':
      return { ...state, channels: [...state.channels, action.payload] };

    case 'SET_CURRENT_CHANNEL':
      return { ...state, currentChannel: action.payload };

    case 'DELETE_CHANNEL':
      return { ...state, currentChannel: null };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.channelName]: [
            ...(state.messages[action.payload.channelName] || []),
            action.payload,
          ],
        },
      };

    case 'INITIALIZE_CHANNEL_MESSAGES':
      if (state.messages[action.payload.channelName]) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.channelName]: [],
        },
      };

    default:
      return state;
  }
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { token } = useAuthContext();
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  useEffect(() => {
    if (!token) return;

    wsService.connect(token);

    wsService.on('connected', () => dispatch({ type: 'SET_CONNECTED', payload: true }));
    wsService.on('disconnected', () => dispatch({ type: 'SET_CONNECTED', payload: false }));
    wsService.on('incoming_message', (incomingMessage: IncomingMessage) =>
      dispatch({ type: 'ADD_MESSAGE', payload: incomingMessage })
    );

    return () => {
      wsService.disconnect();
      wsService.removeAllListeners();
    };
  }, [token, wsService]);

  const actions = {
    sendMessage: async (message: OutgoingMessage): Promise<void> => {
      if (!token) return;
      try {
        wsService.send(message);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    joinChannel: async (channelName: string, password?: string): Promise<APIResponse<void>> => {
      try {
        const res = await axiosInstance.patch(
          `${BASE_URL}/joinchannel`,
          { channelName: channelName, channelPassword: password },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          dispatch({ type: 'SET_CURRENT_CHANNEL', payload: channelName });
          return { success: res.data.success, data: res.data.data };
        } else {
          return { success: res.data.success, error: res.data.error };
        }
      } catch (error) {
        if (isAxiosError(error)) {
          return {
            success: false,
            error: {
              message: error.response?.data?.message || 'Failed to get channel',
              code: error.response?.status || 500,
            },
          };
        }
        return {
          success: false,
          error: { message: 'Unknown error', code: 500 },
        };
      }
    },
    createChannel: async (
      channelName: string,
      description?: string,
      password?: string
    ): Promise<APIResponse<Channel>> => {
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
          dispatch({ type: 'ADD_CHANNEL', payload: validatedChannel });
          return { success: res.data.success, data: validatedChannel };
        } else {
          return { success: res.data.success, error: res.data.error };
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Invalid channel data:', error.errors);
          return {
            success: false,
            error: { message: 'Server returned invalid channel data', code: 422 },
          };
        }
        if (isAxiosError(error)) {
          return {
            success: false,
            error: {
              message: error.response?.data?.message || 'Failed to create channel',
              code: error.response?.status || 500,
            },
          };
        }
        return {
          success: false,
          error: { message: 'Unknown error', code: 500 },
        };
      }
    },
    deleteChannel: async (channelName: string): Promise<APIResponse<void>> => {
      try {
        const res = await axiosInstance.delete(
          `${BASE_URL}/deletechannel/${encodeURIComponent(channelName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          dispatch({ type: 'DELETE_CHANNEL', payload: channelName });
          return { success: res.data.success, data: res.data.data };
        } else {
          return { success: res.data.success, error: res.data.error };
        }
      } catch (error) {
        if (isAxiosError(error)) {
          return {
            success: false,
            error: {
              message: error.response?.data?.message || 'Failed to create channel',
              code: error.response?.status || 500,
            },
          };
        }
        return {
          success: false,
          error: { message: 'Unknown error', code: 500 },
        };
      }
    },
    leaveChannel: async (channelName: string) => {
      try {
        const res = await axiosInstance.patch(
          `${BASE_URL}/leavechannel/${encodeURIComponent(channelName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          dispatch({ type: 'SET_CURRENT_CHANNEL', payload: null });
          return { success: res.data.success, data: res.data.data };
        } else {
          return { success: res.data.success, error: res.data.error };
        }
      } catch (error) {
        if (isAxiosError(error)) {
          return {
            success: false,
            error: {
              message: error.response?.data?.message || 'Failed to leave channel',
              code: error.response?.status || 500,
            },
          };
        }
        return {
          success: false,
          error: { message: 'Unknown error', code: 500 },
        };
      }
    },
    getChannels: async (): Promise<APIResponse<Channel[]>> => {
      try {
        const res = await axiosInstance.get(`${BASE_URL}/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          const validatedChannels = z.array(ChannelSchema).parse(res.data.data);
          validatedChannels.forEach((channel) => {
            dispatch({
              type: 'INITIALIZE_CHANNEL_MESSAGES',
              payload: { channelName: channel.name },
            });
          });
          dispatch({ type: 'SET_CHANNELS', payload: validatedChannels });
          return { success: res.data.success, data: validatedChannels };
        } else {
          return { success: res.data.success, error: res.data.error };
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Invalid channels data:', error.errors);
          return {
            success: false,
            error: {
              message: 'Server returned invalid channels data',
              code: 422,
            },
          };
        }
        if (isAxiosError(error)) {
          return {
            success: false,
            error: {
              message: error.response?.data?.message || 'Failed to get channels',
              code: error.response?.status || 500,
            },
          };
        }
        return {
          success: false,
          error: { message: 'Unknown error', code: 500 },
        };
      }
    },
  };

  return <ChatContext.Provider value={{ state, actions }}>{children}</ChatContext.Provider>;
};
