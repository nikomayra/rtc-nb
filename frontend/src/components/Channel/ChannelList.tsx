import { useEffect } from 'react';
import { useChannelContext } from '../../hooks/useChannelContext';
import { ChannelItem } from './ChannelItem';
import { CreateChannelForm } from './CreateChannelForm';

export const ChannelList = () => {
  const { channels, fetchChannels, joinChannel, createChannel } =
    useChannelContext();

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return (
    <div className='channels-container'>
      {channels.map((channel) => (
        <ChannelItem
          key={channel.name}
          channel={channel}
          onJoin={joinChannel}
        />
      ))}
      <CreateChannelForm onSubmit={createChannel} />
    </div>
  );
};
