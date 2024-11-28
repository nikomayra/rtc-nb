import { createContext } from 'react';
import { APIResponse, Channel } from '../types/interfaces';

import { IncomingMessage, OutgoingMessage } from '../types/interfaces';

interface ChatState {
  channels: Channel[];
  currentChannel: string | null;
  messages: Record<string, IncomingMessage[]>;
  isConnected: boolean;
}

interface ChatContext {
  state: ChatState;
  actions: {
    sendMessage: (message: OutgoingMessage) => Promise<void>;
    joinChannel: (channelName: string, password?: string) => Promise<APIResponse<void>>;
    createChannel: (
      channelName: string,
      description?: string,
      password?: string
    ) => Promise<APIResponse<Channel>>;
    deleteChannel: (channelName: string) => Promise<APIResponse<void>>;
    leaveChannel: (channelName: string) => Promise<APIResponse<void>>;
    getChannels: () => Promise<APIResponse<Channel[]>>;
    // updateChannel: (channel: Channel) => Promise<APIResponse<void>>;
  };
}

export const ChatContext = createContext<ChatContext | undefined>(undefined);
