import { createContext } from 'react';
import { IncomingMessage, OutgoingMessage } from '../types/interfaces';

interface MessageContextType {
  messages: IncomingMessage[];
  isConnected: boolean;
  sendMessage: (message: OutgoingMessage) => Promise<void>;
}

export const MessageContext = createContext<MessageContextType | null>(null);
