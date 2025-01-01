import { createContext } from "react";
import { IncomingMessage, OutgoingMessage } from "../types/interfaces";

interface WebSocketContext {
  state: {
    isConnected: boolean;
  };
  actions: {
    connect: (token: string, channelName: string) => void;
    disconnect: () => void;
    send: (message: OutgoingMessage) => void;
    setMessageHandler: (handler: (message: IncomingMessage) => void) => void;
  };
}

export const WebSocketContext = createContext<WebSocketContext | null>(null);
