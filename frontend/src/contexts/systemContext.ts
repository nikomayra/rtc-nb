import { createContext, Dispatch, SetStateAction } from "react";
import { Channel } from "../types/interfaces";

export interface SystemContext {
  state: {
    channels: Channel[];
    currentChannel: Channel | null;
    onlineUsersCount: number;
  };
  actions: {
    // State setters - proper React pattern using SetStateAction
    setChannels: Dispatch<SetStateAction<Channel[]>>;
    setCurrentChannel: (channel: Channel | null) => void;
    setOnlineUsersCount: Dispatch<SetStateAction<number>>;

    // Channel actions
    joinChannel: (channelName: string, password?: string) => Promise<void>;
    createChannel: (channelName: string, description?: string, password?: string) => Promise<void>;
    deleteChannel: (channelName: string) => Promise<void>;
    leaveChannel: (channelName: string) => Promise<void>;
    fetchChannels: () => Promise<void>;
    fetchCountOfAllOnlineUsers: () => Promise<void>;
  };
}

export const SystemContext = createContext<SystemContext | null>(null);
