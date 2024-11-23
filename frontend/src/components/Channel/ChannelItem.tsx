import React from 'react';
import { Channel } from '../../types/interfaces';

type ChannelItemProps = {
  channel: Channel;
  onJoin: (channelName: string, password?: string) => Promise<boolean>;
  currentChannel: string | null;
};

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  onJoin,
  currentChannel,
}) => {
  return (
    <div className='channel-item'>
      <button onClick={() => onJoin(channel.name)}>
        {channel.name}
        {currentChannel === channel.name ? ' ✅' : ' '}
        {channel.isPrivate ? ' 🔒' : ' 🔓'}
      </button>
    </div>
  );
};
