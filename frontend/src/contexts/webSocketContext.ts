import { createContext } from "react";
import { IncomingMessage, OutgoingMessage } from "../types/interfaces";

export type MessageHandlers = {
  onChatMessage?: (message: IncomingMessage) => void;
  onSketchMessage?: (message: IncomingMessage) => void;
  onChannelUpdate?: (message: IncomingMessage) => void;
  onMemberUpdate?: (message: IncomingMessage) => void;
};

interface WebSocketContext {
  state: {
    systemConnected: boolean;
    channelConnected: boolean;
  };
  actions: {
    connectChannel: (token: string, channelName: string) => void;
    connectSystem: (token: string) => void;
    disconnect: () => void;
    disconnectAll: () => void;
    send: (message: OutgoingMessage) => void;
    setMessageHandlers: (handlers: MessageHandlers) => void;
  };
}

export const WebSocketContext = createContext<WebSocketContext | null>(null);
