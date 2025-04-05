import React from "react";
import { OutgoingMessage, ChannelUpdateAction, Channel, IncomingMessage } from "../types/interfaces";

export interface SystemMessageHandler {
  onChannelUpdate?: (action: ChannelUpdateAction, channel: Channel) => void;
  onSystemUserStatus?: (count: number) => void;
  // ... other system message types
}

export interface ChannelMessageHandler {
  onChatMessage?: (message: IncomingMessage) => void;
  onMemberUpdate?: (message: IncomingMessage) => void;
  onUserStatus?: (username: string, status: "online" | "offline") => void;
  // ... other channel message types
}

export interface WebSocketContextType {
  state: {
    systemConnected: boolean;
    channelConnected: boolean;
  };
  actions: {
    connectSystem: (token: string) => void;
    connectChannel: (token: string, channelName: string) => void;
    disconnectChannel: () => void;
    disconnectAll: () => void;
    send: (message: OutgoingMessage) => void;
    setSystemHandlers: (handlers: SystemMessageHandler) => void;
    setChannelHandlers: (handlers: ChannelMessageHandler) => void;
  };
}

export const WebSocketContext = React.createContext<WebSocketContextType | null>(null);
