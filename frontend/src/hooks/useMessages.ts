import { useState, useEffect, useCallback } from 'react';
import { messagesApi } from '../api/messagesApi';
import { Message } from '../types/interfaces';
import { useAuth } from './useAuth';

export const useMessages = (channelName: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!token || !channelName) return;

    let ws: WebSocket;

    const connect = async () => {
      try {
        ws = await messagesApi.connectWebSocket(token);

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);
          console.log('WebSocket message received:', message);
        };

        ws.onopen = () => {
          setIsConnected(true);
          console.log('WebSocket connection opened');
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          console.log('WebSocket connection closed:', event.code, event.reason);
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
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
