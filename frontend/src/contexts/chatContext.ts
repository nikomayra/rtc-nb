import { createContext } from "react";
import { Channel } from "../types/interfaces";

import { IncomingMessage, OutgoingMessage } from "../types/interfaces";

interface ChatState {
  channels: Channel[];
  currentChannel: string | null;
  messages: Record<string, IncomingMessage[]>;
}

interface ChatContext {
  state: ChatState;
  actions: {
    sendMessage: (message: OutgoingMessage) => void;
    joinChannel: (channelName: string, password?: string) => Promise<void>;
    createChannel: (channelName: string, description?: string, password?: string) => Promise<void>;
    deleteChannel: (channelName: string) => Promise<void>;
    leaveChannel: (channelName: string) => Promise<void>;
    getChannels: () => Promise<void>;
    // updateChannel: (channel: Channel) => Promise<APIResponse<void>>;
  };
}

export const ChatContext = createContext<ChatContext | null>(null);
