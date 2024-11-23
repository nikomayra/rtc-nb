import { useState, useCallback, useEffect } from 'react';
import { channelsApi } from '../api/channelsApi';
import { Channel } from '../types/interfaces';
import { useAuthContext } from './useAuthContext';

//TODO: Maybe channel join/creation should be a websocket event so it updates "live"
//otherwise we'd need to refetch channels on a timer so clients see available channels
export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const { token } = useAuthContext();

  const joinChannel = useCallback(
    async (channelName: string, password?: string): Promise<boolean> => {
      const response = await channelsApi.join(channelName, password, token);
      if (response.success) {
        setCurrentChannel(channelName);
        sessionStorage.setItem('currentChannel', channelName);
        console.log('Joined channel:', channelName);
        return true;
      } else {
        console.error('Failed to join channel:', response.error.message);
        return false;
      }
    },
    [token]
  );

  useEffect(() => {
    //if currentChannel is stored in sessionStorage, still exists & is public, try to join it
    //otherwise clear currentChannel
    const storedCurrentChannel = sessionStorage.getItem('currentChannel');
    if (storedCurrentChannel) {
      const channel = channels.find(
        (channel) => channel.name === storedCurrentChannel
      );
      if (channel && !channel.isPrivate) {
        setCurrentChannel(storedCurrentChannel);
        joinChannel(storedCurrentChannel, undefined);
      } else {
        setCurrentChannel('');
      }
    }
  }, [channels, joinChannel]);

  const fetchChannels = useCallback(async (): Promise<void> => {
    if (!token) return;

    const response = await channelsApi.getAll(token);

    if (response.success) {
      setChannels(response.data);
    } else {
      console.error('Failed to fetch channels:', response.error.message);
    }
  }, [token]);

  const createChannel = async (
    name: string,
    description: string,
    password?: string
  ): Promise<boolean> => {
    const response = await channelsApi.create(
      name,
      description,
      password,
      token
    );

    if (response.success) {
      setChannels((prevChannels) => [...prevChannels, response.data]);
      return true;
    } else {
      console.error('Channel creation failed:', response.error.message);
      return false;
    }
  };

  return {
    channels,
    currentChannel,
    fetchChannels,
    createChannel,
    joinChannel,
  };
};
