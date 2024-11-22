import { useState, useCallback, useEffect } from 'react';
import { channelsApi } from '../api/channelsApi';
import { Channel, ChannelSchema } from '../types/interfaces';
import { useAuthContext } from './useAuthContext';
import { z } from 'zod';

//TODO: Maybe channel join/creation should be a websocket event so it updates "live"
//otherwise we'd need to refetch channels on a timer so clients see available channels
export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const { token } = useAuthContext();

  useEffect(() => {
    const storedCurrentChannel = sessionStorage.getItem('currentChannel');

    if (storedCurrentChannel) {
      setCurrentChannel(storedCurrentChannel);
    }
  }, []);

  const fetchChannels = useCallback(async (): Promise<void> => {
    if (!token) return;

    try {
      const response = await channelsApi.getAll(token);
      if (response.success && response.data) {
        setChannels(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  }, [token]);

  const createChannel = async (
    name: string,
    description: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const response = await channelsApi.create(
        name,
        description,
        password,
        token
      );

      if (response.success && response.data) {
        const channel = ChannelSchema.parse(response.data);
        setChannels((prevChannels) => [...prevChannels, channel]);
        return true;
      } else {
        console.error('Channel creation failed:', response.error?.message);
        return false;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid channel data:', error.errors);
        return false;
      } else {
        console.error(
          'Channel creation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        return false;
      }
    }
  };

  const joinChannel = async (
    channelName: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const response = await channelsApi.join(channelName, password, token);
      if (response.success) {
        setCurrentChannel(channelName);
        sessionStorage.setItem('currentChannel', channelName);
        console.log('Joined channel:', channelName);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to join channel:', error);
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
