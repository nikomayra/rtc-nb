import { useState, useEffect, useCallback } from 'react';
import { messagesApi } from '../api/messagesApi';
import { Message } from '../types/interfaces';
import { useAuthContext } from './useAuthContext';

export const useMessages = (channelName: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthContext();

  useEffect(() => {
    if (!token || !channelName) return;

    const setupWebSocket = async () => {
      try {
        const ws = await messagesApi.connectWebSocket(token);

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);
        };

        ws.onopen = () => {
          setIsConnected(true);
          console.log('WebSocket connection opened');
        };

        ws.onclose = () => {
          setIsConnected(false);
          console.log('WebSocket connection closed');
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
      }
    };
    console.log('Setting up WebSocket');
    setupWebSocket();

    return () => {
      messagesApi.closeConnection();
    };
  }, [token, channelName]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!token || !channelName) return;

      try {
        await messagesApi.sendMessage(channelName, text, token);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [token, channelName]
  );

  return {
    messages,
    isConnected,
    sendMessage,
  };
};
