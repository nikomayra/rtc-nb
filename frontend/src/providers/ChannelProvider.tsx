import { useState, useEffect, useCallback, useMemo } from "react";
import { ChannelContext, EnhancedChannelMember } from "../contexts/channelContext";
import { IncomingMessage, ChannelMemberSchema, IncomingMessageSchema, APIErrorResponse } from "../types/interfaces";
import { z } from "zod";
import { useAuthContext } from "../hooks/useAuthContext";
import { channelApi } from "../api/channelApi";
import { useNotification } from "../hooks/useNotification";
import { useSystemContext } from "../hooks/useSystemContext";

interface ChannelProviderProps {
  children: React.ReactNode;
}

// Define schema for online users (simple array of strings)
const OnlineUserSchema = z.string();

export const ChannelProvider = ({ children }: ChannelProviderProps) => {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [members, setMembers] = useState<EnhancedChannelMember[]>([]);
  const { showError } = useNotification();

  const { state: authState } = useAuthContext();
  const token = authState.token;
  const systemContext = useSystemContext();
  const currentChannel = systemContext.state.currentChannel;

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

  // Renamed for clarity
  const fetchOnlineUsernames = useCallback(async (): Promise<string[]> => {
    if (!currentChannel || !token) return [];
    try {
      const response = await channelApi.fetchOnlineUsersInChannel(currentChannel.name, token);
      if (!response.success) {
        throw new Error((response as APIErrorResponse).error.message || "Failed to fetch online usernames");
      }
      const onlineUsernames = z.array(OnlineUserSchema).parse(response.data);
      return onlineUsernames;
    } catch (caughtError) {
      console.error("Failed to fetch online usernames:", caughtError);
      return [];
    }
  }, [currentChannel, token]);

  const fetchMembers = useCallback(async () => {
    if (!currentChannel || !token) return;
    try {
      const response = await channelApi.fetchMembers(currentChannel.name, token);
      if (!response.success) {
        throw new Error((response as APIErrorResponse).error.message || "Failed to load members");
      }
      const parsedMembers = z.array(ChannelMemberSchema).parse(response.data);
      const onlineUsernames = await fetchOnlineUsernames();
      const enhancedMembers = parsedMembers.map((member) => ({
        ...member,
        isOnline: onlineUsernames.includes(member.username),
      }));
      setMembers(enhancedMembers);
    } catch (error) {
      setMembers([]);
      throw error;
    }
  }, [currentChannel, token, fetchOnlineUsernames]);

  const fetchMessages = useCallback(async () => {
    if (!currentChannel || !token) return;
    try {
      const response = await channelApi.fetchMessages(currentChannel.name, token);
      if (!response.success) {
        throw new Error((response as APIErrorResponse).error.message || "Failed to load messages");
      }
      const parsedMessages = z.array(IncomingMessageSchema).parse(response.data);
      setMessages(parsedMessages);
    } catch (error) {
      setMessages([]);
      throw error;
    }
  }, [currentChannel, token]);

  // --- Upload File ---
  const uploadFile = useCallback(
    async (file: File): Promise<{ imagePath: string; thumbnailPath: string }> => {
      if (!currentChannel || !token) {
        const errorMsg = "Cannot upload file: Not connected to a channel or not authenticated.";
        throw new Error(errorMsg);
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("channelName", currentChannel.name);

      const response = await channelApi.uploadFile(formData, token);
      if (!response.success) {
        throw new Error((response as APIErrorResponse).error.message || "Failed to upload file");
      }
      return response.data;
    },
    [currentChannel, token]
  );

  // Fetch channel data when channel or token changes
  useEffect(() => {
    if (!currentChannel || !token) {
      setMessages([]);
      setMembers([]);
      return;
    }
    const loadChannelData = async () => {
      try {
        // Run fetches concurrently
        await Promise.all([fetchMessages(), fetchMembers()]);
      } catch (error) {
        // Show error here for initial load failures
        const message = error instanceof Error ? error.message : "Failed to load channel data";
        console.error("Initial channel data load failed:", error);
        showError(message);
        // State is already cleared within the fetch functions' catch blocks
      }
    };
    loadChannelData();
  }, [token, fetchMessages, fetchMembers, currentChannel, showError]);

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
        fetchMembers,
        fetchMessages,
      },
    }),
    [messages, members, updateMemberOnlineStatus, uploadFile, fetchMembers, fetchMessages]
  );

  return <ChannelContext.Provider value={contextValue}>{children}</ChannelContext.Provider>;
};
