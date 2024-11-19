import { createContext } from 'react';
import { Channel } from '../types/interfaces';

interface ChannelContextType {
  channels: Channel[];
  currentChannel: string;
  fetchChannels: () => Promise<void>;
  joinChannel: (channelName: string) => Promise<boolean>;
  createChannel: (name: string, description: string) => Promise<boolean>;
}

export const ChannelContext = createContext<ChannelContextType | null>(null);
