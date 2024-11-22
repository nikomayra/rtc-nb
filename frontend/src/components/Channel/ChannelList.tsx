import { useEffect } from 'react';
import { useChannelContext } from '../../hooks/useChannelContext';
import { ChannelItem } from './ChannelItem';
import { CreateChannelForm } from './CreateChannelForm';

export const ChannelList = () => {
  const {
    channels,
    currentChannel,
    fetchChannels,
    joinChannel,
    createChannel,
  } = useChannelContext();

  useEffect(() => {
    console.log('Fetching channels');
    fetchChannels();
  }, [fetchChannels]);

  return (
    <div className='channels-container'>
      {channels.map((channel) => (
        <ChannelItem
          key={channel.name}
          channel={channel}
          onJoin={joinChannel}
          currentChannel={currentChannel}
        />
      ))}
      <CreateChannelForm onSubmit={createChannel} />
    </div>
  );
};
