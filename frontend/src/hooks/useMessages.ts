import { useState, useEffect, useCallback } from 'react';
import { messagesApi } from '../api/messagesApi';
import {
  IncomingMessage,
  IncomingMessageSchema,
  OutgoingMessage,
} from '../types/interfaces';
import { useAuthContext } from './useAuthContext';
import { z } from 'zod';

export const useMessages = (channelName: string) => {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthContext();

  useEffect(() => {
    if (!token || !channelName) return;

    const setupWebSocket = async (): Promise<void> => {
      try {
        const ws = await messagesApi.connectWebSocket(token);

        ws.onmessage = (event) => {
          try {
            const incomingMessageJson: JSON = JSON.parse(event.data);
            const parsedIncomingMessage: IncomingMessage =
              IncomingMessageSchema.parse(incomingMessageJson);
            setMessages((prev) => [...prev, parsedIncomingMessage]);
          } catch (error) {
            if (error instanceof z.ZodError) {
              console.error('Invalid incoming message:', error.errors);
            } else {
              console.error('Failed to json parse incoming message:', error);
            }
          }
        };

        setIsConnected(true);
        console.log('WebSocket connection opened in useMessages');

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
    async (message: OutgoingMessage): Promise<void> => {
      if (!token || !channelName) return;

      try {
        await messagesApi.sendMessage(message, token);
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
