import React, { useMemo, ReactNode } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { useChat } from "../../hooks/useChat";

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chat = useChat();

  // Create a value object with state and actions from the hook
  const value = useMemo(
    () => ({
      state: {
        messages: chat.messages,
        channels: chat.channels,
        currentChannel: chat.currentChannel,
        isLoading: chat.isLoading,
        errors: chat.errors,
        connectionState: chat.connectionState,
      },
      actions: {
        sendMessage: chat.sendMessage,
        joinChannel: chat.joinChannel,
        createChannel: chat.createChannel,
        deleteChannel: chat.deleteChannel,
        leaveChannel: chat.leaveChannel,
        fetchChannels: chat.fetchChannels,
        updateMemberRole: chat.updateMemberRole,
        uploadFile: chat.uploadFile,
      },
    }),
    [
      // State dependencies
      chat.messages,
      chat.channels,
      chat.currentChannel,
      chat.isLoading,
      chat.errors,
      chat.connectionState,
      // Action dependencies
      chat.sendMessage,
      chat.joinChannel,
      chat.createChannel,
      chat.deleteChannel,
      chat.leaveChannel,
      chat.fetchChannels,
      chat.updateMemberRole,
      chat.uploadFile,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
