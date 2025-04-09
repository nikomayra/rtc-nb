import { SystemContext } from "../contexts/systemContext";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Channel, ChannelSchema, APIErrorResponse } from "../types/interfaces";
import { z } from "zod";
import { useNotification } from "../hooks/useNotification";
import { useAuthContext } from "../hooks/useAuthContext";
import { systemApi } from "../api/systemApi";

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, token } = useAuthContext().state;
  const { showError, showSuccess } = useNotification();

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [onlineUsersCount, setOnlineUsersCount] = useState<number>(0);

  const setCurrentChannelWithStorage = useCallback((channel: Channel | null) => {
    setCurrentChannel(channel);
    if (channel) {
      sessionStorage.setItem("currentChannelName", channel.name);
    } else {
      sessionStorage.removeItem("currentChannelName");
    }
  }, []);

  const loadInitialChannels = useCallback(async () => {
    if (!token) return;
    try {
      const response = await systemApi.fetchChannels(token);
      if (!response.success) {
        throw new Error((response as APIErrorResponse).error.message || "Failed to initialize channels");
      }
      const parsedChannels = z.array(ChannelSchema).parse(response.data);
      setChannels(parsedChannels);

      const savedChannelName = sessionStorage.getItem("currentChannelName");
      if (savedChannelName) {
        const channel = parsedChannels.find((c) => c.name === savedChannelName);
        setCurrentChannel(channel || null);
        if (!channel) {
          sessionStorage.removeItem("currentChannelName");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize channels";
      console.error("Failed to initialize channels:", error);
      showError(message);
      setChannels([]);
    }
  }, [token, showError]);

  useEffect(() => {
    if (isLoggedIn) {
      loadInitialChannels();
    }
  }, [isLoggedIn, loadInitialChannels]);

  useEffect(() => {
    if (!isLoggedIn) {
      setChannels([]);
      setCurrentChannel(null);
      setOnlineUsersCount(0);
      sessionStorage.removeItem("currentChannelName");
    }
  }, [isLoggedIn]);

  const actions = useMemo(
    () => ({
      setChannels,
      setCurrentChannel: setCurrentChannelWithStorage,
      setOnlineUsersCount,
      joinChannel: async (channelName: string, password?: string) => {
        if (!token) return;
        try {
          await systemApi.joinChannel(channelName, token, password);
          const channel = channels.find((c) => c.name === channelName);
          if (channel) {
            setCurrentChannelWithStorage(channel);
            // showSuccess(`Joined channel: ${channelName}`);
          } else {
            console.error("Joined channel not found in local state:", channelName);
            showError("Failed to set current channel after join");
            loadInitialChannels();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to join channel";
          console.error("Failed to join channel:", error);
          showError(message);
        }
      },
      createChannel: async (channelName: string, description?: string, password?: string) => {
        if (!token) return;
        try {
          const response = await systemApi.createChannel(channelName, token, description, password);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to create channel");
          }
          const newChannel = ChannelSchema.parse(response.data);
          setChannels((prev) => [...prev, newChannel]);
          setCurrentChannelWithStorage(newChannel);
          showSuccess(`Channel '${channelName}' created`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create channel";
          console.error("Failed to create channel:", error);
          showError(message);
        }
      },
      deleteChannel: async (channelName: string) => {
        if (!token) return;
        try {
          await systemApi.deleteChannel(channelName, token);
          setChannels((prev) => prev.filter((c) => c.name !== channelName));
          if (currentChannel?.name === channelName) {
            setCurrentChannelWithStorage(null);
          }
          showSuccess(`Channel '${channelName}' deleted`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete channel";
          console.error("Failed to delete channel:", error);
          showError(message);
        }
      },
      leaveChannel: async (channelName: string) => {
        if (!token) return;
        try {
          await systemApi.leaveChannel(channelName, token);
          if (currentChannel?.name === channelName) {
            setCurrentChannelWithStorage(null);
          }
          // showSuccess(`Left channel: ${channelName}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to leave channel";
          console.error("Failed to leave channel:", error);
          showError(message);
        }
      },
      fetchChannels: async () => {
        await loadInitialChannels();
      },
      fetchCountOfAllOnlineUsers: async () => {
        if (!token) return;
        try {
          const response = await systemApi.fetchCountOfAllOnlineUsers(token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to fetch online user count");
          }
          const count = z.number().int().min(0).parse(response.data);
          setOnlineUsersCount(count);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch online user count";
          console.error("Failed to fetch all online users:", error);
          showError(message);
        }
      },
    }),
    [channels, token, showError, showSuccess, setCurrentChannelWithStorage, currentChannel, loadInitialChannels]
  );

  const value = useMemo(
    () => ({
      state: { channels, currentChannel, onlineUsersCount },
      actions,
    }),
    [channels, currentChannel, onlineUsersCount, actions]
  );

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
};
