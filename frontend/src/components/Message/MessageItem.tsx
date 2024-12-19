import { IncomingMessage, MessageType } from '../../types/interfaces';
import helpers from '../../utils/helpers';

type MessageItemProps = {
  message: IncomingMessage;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const storedUsername = sessionStorage.getItem('username');
  const myMessage = storedUsername == message.username;

  const renderContent = () => {
    switch (message.type) {
      case MessageType.Text:
        return <p className='message-content'>{message.content.text}</p>;
      case MessageType.Image:
        // TODO: Create Modal window hook for image "pop-up"
        return (
          <div className='message-content'>
            <img 
              src={helpers.getFullURL(message.content.thumbnailurl ?? '')} 
              alt='thumbnail'
              onClick={()=> window.open(helpers.getFullURL(message.content.imageurl ?? ''), '_blank')}
              className='message-thumbnail'
              />
              {message.content.text && <p>{message.content.text}</p>}
          </div>
        );
    }
  };

  return (
    <div className={`message-item ${myMessage ? 'my-message' : ''}`}>
      <div className="message-header">
        <span className="message-username">{message.username}</span>
        <span className="message-timestamp">
          {helpers.formatTimestamp(message.timestamp)}
        </span>
      </div>
      {renderContent()}
    </div>
  );
};
