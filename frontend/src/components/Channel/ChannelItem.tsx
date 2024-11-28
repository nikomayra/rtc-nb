import React, { useState } from 'react';
import { Channel } from '../../types/interfaces';

type ChannelItemProps = {
  channel: Channel;
  onJoin: (channelName: string, password?: string) => Promise<void>;
  onDelete: (channelName: string) => Promise<void>;
  onLeave: (channelName: string) => Promise<void>;
  currentChannel: string | null;
};

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  onJoin,
  onDelete,
  onLeave,
  currentChannel,
}) => {
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const onJoinCheck = async () => {
    if (channel.isPrivate && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    try {
      await onJoin(channel.name, channel.isPrivate ? password : undefined);
      setShowPasswordInput(false);
      setPassword('');
    } catch (error) {
      console.error('Failed to join channel:', error);
      // Optionally show error message to user
    }
  };

  return (
    <div className='channel-item'>
      <button onClick={onJoinCheck} title='Join channel'>
        {channel.name}
        {currentChannel === channel.name ? ' ✅' : ' '}
        {channel.isPrivate ? ' 🔒' : ' 🔓'}
      </button>
      {showPasswordInput && channel.isPrivate && (
        <div>
          <input
            type='password'
            placeholder='Enter channel password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={onJoinCheck}>Join</button>
        </div>
      )}
      <div className='channel-item-actions'>
        <button onClick={() => onDelete(channel.name)} title='Delete channel'>
          ❌
        </button>{' '}
        <button onClick={() => onLeave(channel.name)} title='Leave channel'>
          🚪
        </button>
      </div>
    </div>
  );
};
