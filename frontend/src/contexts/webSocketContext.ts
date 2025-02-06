import { createContext } from "react";
import { IncomingMessage, OutgoingMessage } from "../types/interfaces";

export type MessageHandlers = {
  onChatMessage?: (message: IncomingMessage) => void;
  onSketchMessage?: (message: IncomingMessage) => void;
};

interface WebSocketContext {
  state: {
    isConnected: boolean;
  };
  actions: {
    connect: (token: string, channelName: string) => void;
    disconnect: () => void;
    send: (message: OutgoingMessage) => void;
    setMessageHandlers: (handlers: MessageHandlers) => void;
  };
}

export const WebSocketContext = createContext<WebSocketContext | null>(null);
