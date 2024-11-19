import { createContext } from 'react';
import { Message } from '../types/interfaces';

interface MessageContextType {
  messages: Message[];
  isConnected: boolean;
  sendMessage: (text: string) => Promise<void>;
}

export const MessageContext = createContext<MessageContextType | null>(null);
