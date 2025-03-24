import React, { ReactNode } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { useChat } from "../../hooks/useChat";

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chat = useChat();

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
};
