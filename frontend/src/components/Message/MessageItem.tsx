import { Message } from '../../types/interfaces';
import helpers from '../../utils/helpers';

type MessageItemProps = {
  message: Message;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  return (
    <div className='message-item'>
      <p className='message-content'>
        {message.username}: {message.content.text}
      </p>
      <p className='message-timestamp'>
        {helpers.formatTimestamp(message.timestamp)}
      </p>
    </div>
  );
};
