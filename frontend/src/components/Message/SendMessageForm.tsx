import { FormEvent } from 'react';
import { OutgoingMessage } from '../../types/interfaces';
import { useChannelContext } from '../../hooks/useChannelContext';

type SendMessageFormProps = {
  onSend: (message: OutgoingMessage) => Promise<void>;
  isConnected: boolean;
};

export const SendMessageForm = ({
  onSend,
  isConnected,
}: SendMessageFormProps) => {
  const { currentChannel } = useChannelContext();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get('message') as string;

    onSend({
      channelName: currentChannel,
      type: 0, // TODO: Make more robust, 0 is text type...
      content: { text: message },
    });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} id='send-message-form'>
        <input type='text' name='message' />
        <button type='submit' disabled={!isConnected}>
          Send
        </button>
      </form>
    </div>
  );
};
