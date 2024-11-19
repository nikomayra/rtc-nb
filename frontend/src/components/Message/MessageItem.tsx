import { Message } from '../../types/interfaces';

type MessageItemProps = {
  message: Message;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  return (
    <div className='message-item'>
      <p style={{ fontSize: '10px', color: 'gray', fontWeight: 'italic' }}>
        {message.timestamp}
      </p>
      <p>
        {message.username}: {message.content.text}
      </p>
    </div>
  );
};
