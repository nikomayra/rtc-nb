import { useContext, useEffect, useRef } from 'react';
import { ChatContext } from '../../contexts/chatContext';
import { MessageItem } from './MessageItem';
import { SendMessageForm } from './SendMessageForm';

export const MessageList = () => {
  const context = useContext(ChatContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [context?.state.messages, context?.state.currentChannel]);

  if (!context) return null;

  const {
    state: { currentChannel, messages, isConnected },
    actions: { sendMessage },
  } = context;

  if (!currentChannel) {
    return <div className='messages-container'>No channel selected</div>;
  }

  // Check if messages[currentChannel] exists before mapping
  const channelMessages = messages[currentChannel] || [];

  return (
    <div className='messages-container'>
      <div className='messages-list'>
        {channelMessages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <SendMessageForm onSend={sendMessage} isConnected={isConnected} />
    </div>
  );
};
