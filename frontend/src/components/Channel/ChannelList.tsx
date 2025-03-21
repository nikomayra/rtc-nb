import { useContext } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { useAuthContext } from "../../hooks/useAuthContext";
import { ChannelItem } from "./ChannelItem";
import { CreateChannelForm } from "./CreateChannelForm";

export const ChannelList = () => {
  const chatContext = useContext(ChatContext);
  const authContext = useAuthContext();
  if (!chatContext || !authContext) return null;

  const {
    state: { channels, currentChannel },
    actions: { joinChannel, createChannel, deleteChannel, leaveChannel },
  } = chatContext;

  const {
    state: { username },
    actions: { logout },
  } = authContext;

  // Count total online users across all channels
  const totalOnlineUsers = 1;

  return (
    <div className="flex flex-col h-full">
      {/* User Section */}
      <div className="flex items-center justify-between p-2 mb-4 border-b border-primary/20">
        <span className="text-text-light font-medium truncate pr-2">{username}</span>
        <button onClick={logout} className="text-sm text-text-light/70 hover:text-primary transition-colors">
          Logout
        </button>
      </div>

      {/* Channels Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2">
          <h2 className="text-sm font-medium text-text-light/70 uppercase tracking-wider">Channels</h2>
          {totalOnlineUsers > 0 && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
              {totalOnlineUsers} online
            </span>
          )}
        </div>
        <div
          className="flex-1 overflow-y-scroll px-2 
          scrollbar-thin 
        scrollbar-thumb-primary/20 
        scrollbar-track-surface-dark 
        scrollbar-hover:scrollbar-thumb-primary/30"
        >
          <div className="space-y-1 pb-2">
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
          </div>
        </div>
      </div>

      {/* Create Channel Section */}
      <div className="mt-4 pt-4 border-t border-primary/20">
        <CreateChannelForm onSubmit={createChannel} />
      </div>
    </div>
  );
};
