import { SystemContext } from "../contexts/systemContext";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Channel, ChannelSchema, APIErrorResponse } from "../types/interfaces";
import { z } from "zod";
import { useNotification } from "../hooks/useNotification";
import { useAuthContext } from "../hooks/useAuthContext";
import { systemApi } from "../api/systemApi";
import { isAxiosError } from "axios"; // Import for detailed error checking

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  const { showError, showSuccess } = useNotification();
  const { isLoggedIn, token } = useAuthContext().state;

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
      setChannels([]);
      setCurrentChannel(null);
      sessionStorage.removeItem("currentChannelName");
      console.error("Failed to load initial channels:", error);
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || "Failed to load channels.");
      } else if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Failed to load channels: An unexpected error occurred.");
      }
    }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn) {
      loadInitialChannels().catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to initialize channels during login";
        console.error("Initial channel load failed:", error);
        showError(message);
      });
    }
  }, [isLoggedIn, loadInitialChannels, showError]);

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
        if (!token) throw new Error("Not authenticated for joining channel");
        try {
          const response = await systemApi.joinChannel(channelName, token, password);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to join channel");
          }
          let channel = channels.find((c) => c.name === channelName);
          if (channel) {
            setCurrentChannelWithStorage(channel);
          } else {
            console.warn("Joined channel not found locally, refetching channels:", channelName);
            await loadInitialChannels();
            const refreshedChannels = channels;
            channel = refreshedChannels.find((c) => c.name === channelName);
            if (channel) {
              setCurrentChannelWithStorage(channel);
            } else {
              throw new Error("Failed to find the joined channel even after refetching.");
            }
          }
        } catch (error) {
          console.error("Join channel error:", error);
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to join channel.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to join channel: An unexpected error occurred.");
          }
        }
      },
      createChannel: async (channelName: string, description?: string, password?: string) => {
        if (!token) throw new Error("Not authenticated for creating channel");
        if (channels.some((c) => c.name === channelName)) {
          throw new Error("Channel already exists");
        }
        try {
          const response = await systemApi.createChannel(channelName, token, description, password);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to create channel");
          }
          const newChannel = ChannelSchema.parse(response.data);
          setChannels((prev) => {
            if (!prev.some((c) => c.name === newChannel.name)) {
              return [...prev, newChannel];
            }
            return prev;
          });
          setCurrentChannelWithStorage(newChannel);
        } catch (error) {
          console.error("Create channel error:", error);
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to create channel.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to create channel: An unexpected error occurred.");
          }
        }
      },
      deleteChannel: async (channelName: string) => {
        if (!token) throw new Error("Not authenticated for deleting channel");
        try {
          const response = await systemApi.deleteChannel(channelName, token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to delete channel");
          }
          setChannels((prev) => prev.filter((c) => c.name !== channelName));
          if (currentChannel?.name === channelName) {
            setCurrentChannelWithStorage(null);
          }
          showSuccess(`Channel '${channelName}' deleted`);
        } catch (error) {
          console.error("Delete channel error:", error);
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to delete channel.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to delete channel: An unexpected error occurred.");
          }
        }
      },
      leaveChannel: async (channelName: string) => {
        if (!token) throw new Error("Not authenticated for leaving channel");
        try {
          const response = await systemApi.leaveChannel(channelName, token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to leave channel");
          }
          if (currentChannel?.name === channelName) {
            setCurrentChannelWithStorage(null);
          }
        } catch (error) {
          console.error("Leave channel error:", error);
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to leave channel.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to leave channel: An unexpected error occurred.");
          }
        }
      },
      fetchChannels: async () => {
        await loadInitialChannels();
      },
      fetchCountOfAllOnlineUsers: async () => {
        if (!token) throw new Error("Not authenticated for fetching user count");
        try {
          const response = await systemApi.fetchCountOfAllOnlineUsers(token);
          if (!response.success) {
            throw new Error((response as APIErrorResponse).error.message || "Failed to fetch online user count");
          }
          const count = z.number().int().min(0).parse(response.data);
          setOnlineUsersCount(count);
        } catch (error) {
          console.error("Fetch user count error:", error);
          if (isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || "Failed to fetch user count.");
          } else if (error instanceof Error) {
            throw new Error(error.message);
          } else {
            throw new Error("Failed to fetch user count: An unexpected error occurred.");
          }
        }
      },
    }),
    [channels, token, showSuccess, setCurrentChannelWithStorage, currentChannel, loadInitialChannels]
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
