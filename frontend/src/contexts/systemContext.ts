import { createContext } from "react";
import { Channel } from "../types/interfaces";

export interface SystemContext {
  state: {
    channels: Channel[];
    currentChannel: Channel | null;
    onlineUsers: string[];
  };
  actions: {
    joinChannel: (channelName: string, password?: string) => Promise<boolean>;
    createChannel: (channelName: string, description?: string, password?: string) => Promise<boolean>;
    deleteChannel: (channelName: string) => Promise<boolean>;
    leaveChannel: (channelName: string) => Promise<boolean>;
    fetchChannels: () => Promise<Channel[] | null>;
    fetchAllOnlineUsers: () => Promise<string[] | null>;
  };
}

export const SystemContext = createContext<SystemContext | null>(null);
