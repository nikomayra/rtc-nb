import { MessageItem } from './MessageItem';
import { SendMessageForm } from './SendMessageForm';
import { useChannelContext } from '../../hooks/useChannelContext';
import { useMessageContext } from '../../hooks/useMessageContext';

export const MessageList = () => {
  const { channels, currentChannel, joinChannel } = useChannelContext();
  const { messages, sendMessage, isConnected } = useMessageContext();

  const channel = channels.find((channel) => channel.name === currentChannel);
  if (!channel) {
    return <></>;
  } else {
    joinChannel(currentChannel, channel.password ?? undefined);
  }

  return (
    <div className='messages-container'>
      <div className='messages-list'>
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
      <SendMessageForm onSend={sendMessage} isConnected={isConnected} />
    </div>
  );
};
