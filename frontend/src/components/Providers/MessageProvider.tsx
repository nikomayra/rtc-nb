import { useChannels } from '../../hooks/useChannels';
import { useMessages } from '../../hooks/useMessages';
import { MessageContext } from '../../contexts/messageContext';
export const MessageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const channels = useChannels();
  const messages = useMessages(channels.currentChannel);

  return (
    <MessageContext.Provider value={messages}>
      {children}
    </MessageContext.Provider>
  );
};
