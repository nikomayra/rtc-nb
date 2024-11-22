import { useChannelContext } from '../../hooks/useChannelContext';
import { useMessages } from '../../hooks/useMessages';
import { MessageContext } from '../../contexts/messageContext';
export const MessageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const channels = useChannelContext();
  const messages = useMessages(channels.currentChannel);

  return (
    <MessageContext.Provider value={messages}>
      {children}
    </MessageContext.Provider>
  );
};
