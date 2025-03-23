import { createContext } from "react";
import { Channel, IncomingMessage, OutgoingMessage } from "../types/interfaces";

export interface ChatContext {
  state: {
    messages: Record<string, IncomingMessage[]>;
    channels: Channel[];
    currentChannel: string | null;
    isLoading: boolean;
    errors: Record<string, Error | null>;
    connectionState: {
      systemConnected: boolean;
      channelConnected: boolean;
    };
  };
  actions: {
    sendMessage: (message: OutgoingMessage) => void;
    joinChannel: (channelName: string, password?: string) => Promise<boolean>;
    createChannel: (channelName: string, description?: string, password?: string) => Promise<boolean>;
    deleteChannel: (channelName: string) => Promise<boolean>;
    leaveChannel: (channelName: string) => Promise<boolean>;
    fetchChannels: () => Promise<Channel[] | null>;
    updateMemberRole: (channelName: string, username: string, isAdmin: boolean) => Promise<boolean>;
    uploadFile: (channelName: string, file: File, messageText?: string) => Promise<boolean>;
  };
}

export const ChatContext = createContext<ChatContext | null>(null);
