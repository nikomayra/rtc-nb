import { useContext } from 'react';
import { ChatContext } from '../../contexts/chatContext';
import { useAuthContext } from '../../hooks/useAuthContext';
import { ChannelItem } from './ChannelItem';
import { CreateChannelForm } from './CreateChannelForm';
import '../../styles/components/channels.css';

export const ChannelList = () => {
  const chatContext = useContext(ChatContext);
  const authContext = useAuthContext();
  if (!chatContext || !authContext) return null;

  const {
    state: { channels, currentChannel },
    actions: { joinChannel, createChannel, deleteChannel, leaveChannel },
  } = chatContext;

  const {
    actions: { logout },
  } = authContext;

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
      <button onClick={logout}>Logout</button>
    </div>
  );
};
