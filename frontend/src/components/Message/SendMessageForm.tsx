import { FormEvent } from 'react';

type SendMessageFormProps = {
  onSend: (message: string) => Promise<void>;
  isConnected: boolean;
};

export const SendMessageForm = ({
  onSend,
  isConnected,
}: SendMessageFormProps) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get('message') as string;

    onSend(message);
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
