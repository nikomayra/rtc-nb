import { createContext } from "react";
import { OutgoingMessage, IncomingMessage } from "../types/interfaces";

export type SystemMessageHandler = {
  onChannelUpdate?: (message: IncomingMessage) => void;
  onSystemUserStatus?: (message: IncomingMessage) => void;
  // Add other system message handlers
};

export type ChannelMessageHandler = {
  onUserStatus?: (username: string, status: "online" | "offline") => void;
  onChatMessage?: (message: IncomingMessage) => void;
  onMemberUpdate?: (message: IncomingMessage) => void;
  onSketchMessage?: (message: IncomingMessage) => void;
  // Add other message type handlers here as needed
};

export interface WebSocketContextActions {
  connectSystem: (token: string) => void;
  disconnectSystem: () => void;
  connectChannel: (token: string, channelName: string) => void;
  disconnectChannel: () => void;
  send: (message: OutgoingMessage) => void;
  addChannelHandlers: (key: string, handlers: ChannelMessageHandler) => void;
  removeChannelHandlers: (key: string) => void;
  addSystemHandlers: (key: string, handlers: SystemMessageHandler) => void;
  removeSystemHandlers: (key: string) => void;
}

export interface WebSocketContextType {
  state: {
    systemConnected: boolean;
    channelConnected: boolean;
  };
  actions: WebSocketContextActions;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);
