import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import { ChannelContext, EnhancedChannelMember } from "../contexts/channelContext";
import { IncomingMessage } from "../types/interfaces";
import { useAuthContext } from "../hooks/useAuthContext";
import { SystemContext } from "../contexts/systemContext";
import { channelApi } from "../api/channelApi";
import { useNotification } from "../hooks/useNotification";

interface ChannelProviderProps {
  children: React.ReactNode;
}

export const ChannelProvider = ({ children }: ChannelProviderProps) => {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [members, setMembers] = useState<EnhancedChannelMember[]>([]);
  const { showError } = useNotification();

  const {
    state: { token },
  } = useAuthContext();
  const systemContext = useContext(SystemContext);

  const currentChannel = systemContext?.state.currentChannel;

  // Clear messages/members when changing channels
  useEffect(() => {
    setMessages([]);
    setMembers([]);
  }, [currentChannel?.name]);

  const updateMemberOnlineStatus = useCallback((username: string, isOnline: boolean) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) => (member.username === username ? { ...member, isOnline } : member))
    );
  }, []);

  const fetchOnlineMembers = useCallback(async () => {
    if (!currentChannel) return;
    const response = await channelApi.fetchOnlineUsersInChannel(currentChannel.name, token);
    if (response.success) {
      response.data.forEach((username) => {
        updateMemberOnlineStatus(username, true);
      });
    } else {
      showError("Failed to fetch online members");
    }
  }, [currentChannel, showError, token, updateMemberOnlineStatus]);

  const fetchMembers = useCallback(async () => {
    try {
      if (!currentChannel) return;
      const response = await channelApi.fetchMembers(currentChannel.name, token);
      if (response.success) {
        const enhancedMembers = response.data.map((member) => ({
          ...member,
          isOnline: false,
        }));
        setMembers(enhancedMembers);
        fetchOnlineMembers();
      } else {
        showError("Failed to fetch members");
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      showError("Failed to load members");
    }
  }, [currentChannel, token, fetchOnlineMembers, showError]);

  const fetchMessages = useCallback(async () => {
    try {
      if (!currentChannel) return;
      const response = await channelApi.fetchMessages(currentChannel.name, token);
      if (response.success) {
        setMessages(response.data);
      } else {
        showError("Failed to fetch messages");
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      showError("Failed to load messages");
    }
  }, [currentChannel, token, showError]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!currentChannel) {
        const errorMsg = "No channel selected for file upload";
        showError(errorMsg);
        throw new Error(errorMsg);
      }
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("channelName", currentChannel.name);
        const response = await channelApi.uploadFile(formData, token);
        if (response.success) {
          return response.data;
        } else {
          const errorMsg = response.error?.message || "Failed to upload file";
          showError(errorMsg);
          throw new Error(errorMsg);
        }
      } catch (err) {
        console.error("Error uploading file:", err);
        const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred during file upload";
        showError(errorMsg);
        throw err;
      }
    },
    [currentChannel, showError, token]
  );

  // Fetch channel messages/members when channel changes
  useEffect(() => {
    if (!currentChannel || !token) {
      setMessages([]);
      setMembers([]);
      return;
    }

    fetchMessages();
    fetchMembers();
  }, [token, fetchMessages, fetchMembers, currentChannel]);

  // Create context value
  const contextValue = useMemo(
    () => ({
      state: {
        messages,
        members,
      },
      actions: {
        setMessages,
        setMembers,
        updateMemberOnlineStatus,
        uploadFile,
      },
    }),
    [messages, members, updateMemberOnlineStatus, uploadFile]
  );

  return <ChannelContext.Provider value={contextValue}>{children}</ChannelContext.Provider>;
};
