import { useContext } from 'react';
import { ChatContext } from '../../contexts/chatContext';
import { ChannelItem } from './ChannelItem';
import { CreateChannelForm } from './CreateChannelForm';

export const ChannelList = () => {
  const context = useContext(ChatContext);
  if (!context) return null;

  const {
    state: { channels, currentChannel },
    actions: { joinChannel, createChannel, deleteChannel, leaveChannel },
  } = context;

  return (
    <div className='channels-container'>
      {channels.map((channel) => (
        <ChannelItem
          key={channel.name}
          channel={channel}
          onJoin={joinChannel}
          onLeave={leaveChannel}
          onDelete={deleteChannel}
          currentChannel={currentChannel}
        />
      ))}
      <CreateChannelForm onSubmit={createChannel} />
    </div>
  );
};
