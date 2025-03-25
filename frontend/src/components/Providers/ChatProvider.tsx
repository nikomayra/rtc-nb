import React, { ReactNode, useMemo } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { useChat } from "../../hooks/useChat";

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chatHook = useChat();

  const stableState = useMemo(
    () => ({
      currentChannel: chatHook.state.currentChannel,
      channels: chatHook.state.channels,
      connectionState: chatHook.state.connectionState,
    }),
    [chatHook.state.currentChannel, chatHook.state.channels, chatHook.state.connectionState]
  );

  const dynamicState = useMemo(
    () => ({
      messages: chatHook.state.messages,
      isLoading: chatHook.state.isLoading,
      errors: chatHook.state.errors,
      onlineUsers: chatHook.state.onlineUsers,
    }),
    [chatHook.state.messages, chatHook.state.isLoading, chatHook.state.errors, chatHook.state.onlineUsers]
  );

  // Stable actions reference
  const actions = useMemo(() => chatHook.actions, [chatHook.actions]);

  // Combined context value
  const value = useMemo(
    () => ({
      state: {
        ...stableState,
        ...dynamicState,
      },
      actions,
    }),
    [stableState, dynamicState, actions]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
