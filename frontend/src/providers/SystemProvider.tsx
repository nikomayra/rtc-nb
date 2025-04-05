import { SystemContext } from "../contexts/systemContext";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Channel } from "../types/interfaces";
import { useNotification } from "../hooks/useNotification";
import { useAuthContext } from "../hooks/useAuthContext";
import { systemApi } from "../api/systemApi";

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, token } = useAuthContext().state;
  const { showError } = useNotification();

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

  // Initialize data on mount
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    const initialize = async () => {
      try {
        const [channelsResponse] = await Promise.all([systemApi.fetchChannels(token)]);

        if (channelsResponse.success) {
          setChannels(channelsResponse.data);
          // Restore current channel from session storage if available
          const savedChannelName = sessionStorage.getItem("currentChannelName");
          if (savedChannelName) {
            const channel = channelsResponse.data.find((c) => c.name === savedChannelName);
            if (channel) {
              setCurrentChannel(channel);
            } else {
              sessionStorage.removeItem("currentChannelName");
            }
          }
        } else {
          showError("Failed to fetch channels");
        }
      } catch (error) {
        console.error("Failed to initialize system data:", error);
        showError("Failed to initialize system data");
      }
    };

    initialize();
  }, [token, showError, isLoggedIn]);

  useEffect(() => {
    console.log("📊 onlineUsersCount state updated:", onlineUsersCount);
  }, [onlineUsersCount]);

  // Clear state on logout
  useEffect(() => {
    if (!isLoggedIn) {
      setChannels([]);
      setCurrentChannel(null);
      setOnlineUsersCount(0);
    }
  }, [isLoggedIn]);

  // Actions
  const actions = useMemo(
    () => ({
      setChannels,
      setCurrentChannel,
      setOnlineUsersCount,
      joinChannel: async (channelName: string, password?: string) => {
        try {
          const response = await systemApi.joinChannel(channelName, token, password);
          if (response.success) {
            const channel = channels.find((c) => c.name === channelName);
            if (channel) {
              setCurrentChannelWithStorage(channel);
            }
          } else {
            showError("Failed to join channel, could not find channel.");
          }
        } catch (error) {
          console.error("Failed to join channel:", error);
          showError("Server error: Failed to join channel.");
        }
      },
      createChannel: async (channelName: string, description?: string, password?: string) => {
        try {
          const response = await systemApi.createChannel(channelName, token, description, password);
          if (response.success) {
            setCurrentChannelWithStorage(response.data);
          } else {
            showError("Failed to create channel");
          }
        } catch (error) {
          console.error("Failed to create channel:", error);
          showError("Failed to create channel");
        }
      },
      deleteChannel: async (channelName: string) => {
        try {
          const response = await systemApi.deleteChannel(channelName, token);
          if (response.success) {
            setChannels((prev) => prev.filter((c) => c.name !== channelName));
          } else {
            showError("Failed to delete channel");
          }
        } catch (error) {
          console.error("Failed to delete channel:", error);
          showError("Failed to delete channel");
        }
      },
      leaveChannel: async (channelName: string) => {
        try {
          const response = await systemApi.leaveChannel(channelName, token);
          if (response.success) {
            setCurrentChannelWithStorage(null);
          } else {
            showError("Failed to leave channel");
          }
        } catch (error) {
          console.error("Failed to leave channel:", error);
          showError("Failed to leave channel");
        }
      },
      fetchChannels: async () => {
        try {
          const response = await systemApi.fetchChannels(token);
          if (response.success) {
            setChannels(response.data);
          } else {
            showError("Failed to fetch channels");
          }
        } catch (error) {
          console.error("Failed to fetch channels:", error);
          showError("Failed to fetch channels");
        }
      },
      fetchCountOfAllOnlineUsers: async () => {
        try {
          const response = await systemApi.fetchCountOfAllOnlineUsers(token);
          if (response.success) setOnlineUsersCount(response.data);
        } catch (error) {
          console.error("Failed to fetch all online users:", error);
          showError("Failed to fetch all online users");
        }
      },
    }),
    [channels, token, showError, setCurrentChannelWithStorage]
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
