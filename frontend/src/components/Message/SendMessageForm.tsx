import { FormEvent, useContext, useRef } from 'react';
import { OutgoingMessage } from '../../types/interfaces';
import { ChatContext } from '../../contexts/chatContext';

type SendMessageFormProps = {
  onSend: (message: OutgoingMessage) => Promise<void>;
  isConnected: boolean;
};

export const SendMessageForm = ({ onSend, isConnected }: SendMessageFormProps) => {
  const context = useContext(ChatContext);
  const messageInputRef = useRef<HTMLInputElement>(null);

  if (!context) return null;

  const {
    state: { currentChannel },
  } = context;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentChannel) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get('message') as string;

    const outgoingMessage: OutgoingMessage = {
      channelName: currentChannel,
      type: 0, // TODO: Make more robust, 0 is text type...
      content: { text: message },
    };

    await onSend(outgoingMessage);

    if (messageInputRef.current) {
      messageInputRef.current.value = '';
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} id='send-message-form'>
        <input type='text' name='message' ref={messageInputRef} />
        <button type='submit' disabled={!isConnected}>
          Send
        </button>
      </form>
    </div>
  );
};
