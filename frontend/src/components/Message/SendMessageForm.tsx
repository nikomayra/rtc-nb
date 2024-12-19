import { FormEvent, useContext, useRef } from 'react';
import { OutgoingMessage, MessageType } from '../../types/interfaces';
import { ChatContext } from '../../contexts/chatContext';
import { BASE_URL } from '../../utils/constants';
import axiosInstance from '../../api/axiosInstance';
import { AuthContext } from '../../contexts/authContext';

type SendMessageFormProps = {
  onSend: (message: OutgoingMessage) => Promise<void>;
  isConnected: boolean;
};

export const SendMessageForm = ({ onSend, isConnected }: SendMessageFormProps) => {
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!chatContext || !authContext) return null;

  const {
    state: { currentChannel },
  } = chatContext;

  const {
    state: { token },
  } = authContext;

  // const axiosInstance = axios.create({
  //   baseURL: process.env.REACT_APP_API_URL,
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  // });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentChannel) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get('message') as string;
    const file = formData.get('file') as File;

    if (file) {
      // First upload the file
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('channelName', currentChannel);

      try {
        const response = await axiosInstance.post(`${BASE_URL}/upload`, uploadFormData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        if (response.data.success) {
          // Then send websocket message with the URLs
          const outgoingMessage: OutgoingMessage = {
            channelName: currentChannel,
            type: MessageType.Image,
            content: {
              text: message, // Optional message
              imageurl: response.data.data.imagePath,
              thumbnailurl: response.data.data.thumbnailPath
            }
          };
          await onSend(outgoingMessage);
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    } else {
      // Regular text message
      const outgoingMessage: OutgoingMessage = {
        channelName: currentChannel,
        type: MessageType.Text,
        content: { text: message }
      };
      await onSend(outgoingMessage);
    }

    // Clear form
    if (messageInputRef.current) {
      messageInputRef.current.value = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} id='send-message-form'>
        <input type='file' name='file' ref={fileInputRef} />
        <input type='text' name='message' ref={messageInputRef} />
        <button type='submit' disabled={!isConnected}>
          Send
        </button>
      </form>
    </div>
  );
};
