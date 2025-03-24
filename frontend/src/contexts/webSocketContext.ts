import { createContext } from "react";
import { OutgoingMessage, IncomingMessage } from "../types/interfaces";

// Define MessageHandlers interface here instead of importing from service
export interface MessageHandlers {
  onChatMessage?: (message: IncomingMessage) => void;
  onChannelUpdate?: (message: IncomingMessage) => void;
  onMemberUpdate?: (message: IncomingMessage) => void;
  onSketchMessage?: (message: IncomingMessage) => void;
}

// Define the WebSocketContext interface
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
    setMessageHandlers: (handlers: MessageHandlers) => void;
  };
}

// Create the context with a proper default value
export const WebSocketContext = createContext<WebSocketContextType>({
  state: {
    systemConnected: false,
    channelConnected: false,
  },
  actions: {
    connectSystem: () => {},
    connectChannel: () => {},
    disconnectChannel: () => {},
    disconnectAll: () => {},
    send: () => {},
    setMessageHandlers: () => {},
  },
});
