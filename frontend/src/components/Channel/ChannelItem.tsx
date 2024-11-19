import React from 'react';
import { Channel } from '../../types/interfaces';

type ChannelItemProps = {
  channel: Channel;
  onJoin: (channelName: string) => Promise<boolean>;
};

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  onJoin,
}) => {
  return (
    <div className='channel-item'>
      <button onClick={() => onJoin(channel.name)}>{channel.name}</button>
    </div>
  );
};
