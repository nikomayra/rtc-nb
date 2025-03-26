import { SystemContext } from "../../contexts/systemContext";
import { useState } from "react";
import { Channel } from "../../types/interfaces";
import { systemApi } from "../../api/systemApi";
import { useAuthContext } from "../../hooks/useAuthContext";

export const SystemProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    state: { token, username },
  } = useAuthContext();

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Actions
  const joinChannel = async (channel: Channel, password?: string) => {
    const success = await systemApi.joinChannel(channel.name, token, password);
    if (success) setCurrentChannel(channel);
    return success;
  };

  const createChannel = async (channel: Channel) => {
    const success = await systemApi.createChannel(channel.name, token, channel.description, channel.password);
    if (success) setChannels([...channels, channel]);
    return success;
  };

  const deleteChannel = async (channel: Channel) => {
    const success = await systemApi.deleteChannel(channel.name, token);
    if (success) setChannels(channels.filter((c) => c.name !== channel.name));
    return success;
  };

  const leaveChannel = async (channel: Channel) => {
    const success = await systemApi.leaveChannel(channel.name, token);
    if (success) setCurrentChannel(null);
    return success;
  };

  const fetchChannels = async () => {
    const channels = await systemApi.fetchChannels(token);
    if (channels.success) setChannels(channels.data);
  };

  const fetchAllOnlineUsers = async () => {
    const onlineUsers = await systemApi.fetchAllOnlineUsers(token);
    if (onlineUsers.success) setOnlineUsers(onlineUsers.data);
  };

  const fetchOnlineUsersInChannel = async (channel: Channel) => {
    const onlineUsers = await systemApi.fetchOnlineUsersInChannel(channel.name, token);
    if (onlineUsers.success) setOnlineUsers(onlineUsers.data);
    return onlineUsers;
  };

  // state: {
  //   channels: Channel[];
  //   currentChannel: Channel | null;
  //   onlineUsers: string[];
  // };
  // actions: {
  //   joinChannel: (channelName: string, password?: string) => Promise<boolean>;
  //   createChannel: (channelName: string, description?: string, password?: string) => Promise<boolean>;
  //   deleteChannel: (channelName: string) => Promise<boolean>;
  //   leaveChannel: (channelName: string) => Promise<boolean>;
  //   fetchChannels: () => Promise<Channel[] | null>;
  //   fetchAllOnlineUsers: () => Promise<string[] | null>;
  // };

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
};
