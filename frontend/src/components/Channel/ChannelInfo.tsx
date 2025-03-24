import { useState, useContext } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { Channel } from "../../types/interfaces";
import { ChatContext } from "../../contexts/chatContext";
import { Dropdown } from "../Generic/Dropdown";
import { useNotification } from "../../hooks/useNotification";

interface ChannelInfoProps {
  channel?: Channel;
}

export const ChannelInfo = ({ channel }: ChannelInfoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const chatContext = useContext(ChatContext);
  const {
    state: { username },
  } = useAuthContext();
  const { showError } = useNotification();

  if (!chatContext) {
    throw new Error("ChannelInfo must be used within a ChatContext");
  }

  // Early return if no channel is provided
  if (!channel || !channel.members) {
    return (
      <div className="flex flex-col p-4 border-b border-primary/20 min-h-16 overflow-visible w-full">
        <div className="text-text-light/50 text-sm">Loading channel information...</div>
      </div>
    );
  }

  const isAdmin = Object.values(channel.members).some((member) => member.username === username && member.isAdmin);

  // Get online users for this channel
  const onlineUsersSet = chatContext.state.onlineUsers[channel.name] || new Set();
  const onlineCount = onlineUsersSet.size;

  // Ensure member uniqueness by username
  const uniqueMembers = Object.values(channel.members).reduce((acc, member) => {
    // Only keep the first occurrence of each username
    if (!acc[member.username]) {
      acc[member.username] = member;
    }
    return acc;
  }, {} as Record<string, (typeof channel.members)[0]>);

  const sortedMembers = Object.values(uniqueMembers).sort((a, b) => {
    if (a.isAdmin === b.isAdmin) return a.username.localeCompare(b.username);
    return a.isAdmin ? -1 : 1;
  });

  const handleRoleToggle = async (memberUsername: string, newIsAdmin: boolean) => {
    try {
      const success = await chatContext.actions.updateMemberRole(channel.name, memberUsername, newIsAdmin);

      if (!success) {
        const errorMsg = "Failed to update user role. Please try again.";
        showError(errorMsg);
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      showError("Failed to update user role.");
    }
  };

  const membersList = (
    <>
      {sortedMembers.map((member) => {
        const isUserOnline = onlineUsersSet.has(member.username);
        return (
          <div
            key={member.username}
            className="flex items-center justify-between py-2 px-3 
              hover:bg-surface-dark/50 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`h-2 w-2 rounded-full ${isUserOnline ? "bg-green-500" : "bg-gray-400"}`}
                title={isUserOnline ? "Online" : "Offline"}
              />
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  member.isAdmin ? "bg-primary/10 text-primary" : "bg-surface-dark/50 text-text-light/50"
                }`}
              >
                {member.isAdmin ? "admin" : "user"}
              </span>
              <span className="text-sm truncate flex-1">{member.username}</span>
            </div>

            {isAdmin && member.username !== username && member.username !== channel.createdBy && (
              <button
                onClick={() => handleRoleToggle(member.username, !member.isAdmin)}
                className={`text-xs px-2 py-1 rounded flex-none ml-2 ${
                  member.isAdmin
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-surface-dark text-text-light/50 hover:text-primary"
                } transition-colors`}
              >
                {member.isAdmin ? "Demote" : "Promote"}
              </button>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <div className="relative flex flex-col items-start space-y-4">
      <div className="flex flex-col p-4 border-b border-primary/20 min-h-16 overflow-visible w-full">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full whitespace-nowrap">
            <Dropdown
              trigger={
                Object.keys(channel.members).length === 1 ? (
                  <span>{Object.keys(channel.members).length} Member</span>
                ) : (
                  <span>{Object.keys(channel.members).length} Members</span>
                )
              }
              isOpenExternal={isOpen}
              setIsOpenExternal={setIsOpen}
              position="left"
            >
              {membersList}
            </Dropdown>
            <h2 className="flex font-medium text-text-light truncate">{channel.name}</h2>
            <span className="flex ml-2 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
              {onlineCount} online
            </span>
          </div>

          <div
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="cursor-pointer group w-full select-none"
          >
            <p
              className={`text-xs text-text-light/50 ${
                isDescriptionExpanded ? "whitespace-normal break-words" : "truncate"
              } text-left group-hover:text-primary/70 transition-colors w-full max-w-full`}
            >
              {channel.description || "No description provided"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
