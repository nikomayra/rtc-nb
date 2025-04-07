import { useContext, useState } from "react";
import { ChannelItem } from "./ChannelItem";
import { CreateChannelForm } from "./CreateChannelForm";
import LogOut from "../Auth/LogOut";
import { SystemContext } from "../../contexts/systemContext";

export const ChannelList = () => {
  const systemContext = useContext(SystemContext);
  if (!systemContext) throw new Error("SystemContext not found");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <LogOut />

      {/* Channels Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2">
          <h2 className="text-sm font-medium text-text-light/70 uppercase tracking-wider">Channels</h2>
          <span
            className={`flex ml-2 text-xs ${
              systemContext?.state.onlineUsersCount && systemContext?.state.onlineUsersCount > 0
                ? "bg-green-600/20 text-green-400"
                : "bg-gray-700/20 text-gray-400"
            } px-2 py-0.5 rounded-full truncate whitespace-nowrap`}
          >
            {systemContext?.state.onlineUsersCount} online
          </span>
          <span className="text-xs bg-gray-700/20 text-gray-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
            <div className="flex items-center whitespace-nowrap">
              <div className="flex-none w-2 h-2 rounded-full bg-warning mr-1" />
              Private |
              <div className="flex-none w-2 h-2 rounded-full bg-info ml-1 mr-1" />
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
            {systemContext?.state.channels.map((channel) => (
              <ChannelItem key={channel.name} channel={channel} />
            ))}
          </div>
        </div>
      </div>

      {/* Create Channel Section */}
      <div className="mt-4 pt-4 border-t border-primary/20">
        <button
          onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}
          className="flex items-center justify-between w-full px-2 py-1 text-sm font-medium 
          text-text-light/70 hover:text-primary transition-colors cursor-pointer select-none group"
        >
          <span className="uppercase tracking-wider">Create Channel</span>
          <svg
            className={`w-4 h-4 transition-transform ${isCreateFormOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isCreateFormOpen && (
          <div className="mt-3 px-2">
            <CreateChannelForm />
          </div>
        )}
      </div>
    </div>
  );
};
