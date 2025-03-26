import { useCallback, useContext, useRef, useState } from "react";
import { ChatContext } from "../../contexts/systemContext";
import { useAuthContext } from "../../hooks/useAuthContext";
import { ChannelItem } from "./ChannelItem";
import { CreateChannelForm } from "./CreateChannelForm";
import { Channel } from "../../types/interfaces";
import { ChatService } from "../../services/ChatService";

export const ChannelList = () => {
  // const chatContext = useContext(ChatContext);
  const authContext = useAuthContext();
  // const wsContext = useContext(WebSocketContext);

  const [channels, setChannels] = useState<Channel[]>([]);
  const chatService = useRef(ChatService.getInstance());

  // Create wrapper functions with defensive programming
  const handleJoinChannel = useCallback(
    async (channelName: string, password?: string) => {
      if (!chatService) return;
      await chatService.joinChannel(channelName, authContext.state.token, password);
    },
    [chatService, authContext.state.token]
  );

  const handleLeaveChannel = useCallback(
    async (channelName: string) => {
      if (!chatService) return;
      await chatService.leaveChannel(channelName, authContext.state.token);
    },
    [chatService, authContext.state.token]
  );

  const handleDeleteChannel = useCallback(
    async (channelName: string) => {
      if (!chatService) return;
      await chatService.deleteChannel(channelName, authContext.state.token);
    },
    [chatService, authContext.state.token]
  );

  const handleCreateChannel = useCallback(
    async (name: string, description?: string, password?: string) => {
      if (!chatService) return;
      await chatService.createChannel(name, authContext.state.token, description, password);
    },
    [chatService, authContext.state.token]
  );

  // Enhanced logout handler that disconnects all websocket connections
  // const handleLogout = useCallback(async () => {
  //   if (wsContext) {
  //     console.log("Disconnecting all WebSockets before logout");
  //     wsContext.actions.disconnectAll();
  //   }
  //   await authContext.actions.logout();
  // }, [authContext.actions, wsContext]);

  // Early return if contexts are not available
  // if (!chatContext || !authContext) return null;

  // const {
  //   state: { channels, currentChannel },
  // } = chatContext;

  // const {
  //   state: { username },
  // } = authContext;

  return (
    <div className="flex flex-col h-full">
      {/* User Section */}
      {/* <div className="flex items-center justify-between p-2 mb-4 border-b border-primary/20">
        <span className="text-text-light font-medium truncate pr-2">{username}</span>
        <button onClick={handleLogout} className="text-sm text-text-light/70 hover:text-primary transition-colors">
          Logout
        </button>
      </div> */}

      {/* Channels Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2">
          <h2 className="text-sm font-medium text-text-light/70 uppercase tracking-wider">Channels</h2>
          <span className="text-xs bg-gray-700/20 text-gray-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
            <div className="flex items-center whitespace-nowrap">
              <div className="flex-none w-2 h-2 rounded-full bg-warning mr-1" />
              Private |
              <div className="flex-none w-2 h-2 rounded-full bg-success ml-1 mr-1" />
              Public
            </div>
          </span>
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
                onJoin={handleJoinChannel}
                onLeave={handleLeaveChannel}
                onDelete={handleDeleteChannel}
                currentChannel={currentChannel}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Create Channel Section */}
      <div className="mt-4 pt-4 border-t border-primary/20">
        <CreateChannelForm onSubmit={handleCreateChannel} />
      </div>
    </div>
  );
};
