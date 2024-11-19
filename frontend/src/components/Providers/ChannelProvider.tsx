import { ChannelContext } from '../../contexts/channelContext';
import { useChannels } from '../../hooks/useChannels';

export const ChannelProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const channels = useChannels();

  return (
    <ChannelContext.Provider value={channels}>
      {children}
    </ChannelContext.Provider>
  );
};
