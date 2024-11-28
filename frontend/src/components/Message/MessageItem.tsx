import { IncomingMessage } from '../../types/interfaces';
import helpers from '../../utils/helpers';

type MessageItemProps = {
  message: IncomingMessage;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const storedUsername = sessionStorage.getItem('username');
  const myMessage = storedUsername == message.username;
  return (
    <div className={`message-item ${myMessage ? 'my-message' : ''}`}>
      <p className='message-content'>
        {message.username}: {message.content.text}
      </p>
      <p className='message-timestamp'>{helpers.formatTimestamp(message.timestamp)}</p>
    </div>
  );
};
