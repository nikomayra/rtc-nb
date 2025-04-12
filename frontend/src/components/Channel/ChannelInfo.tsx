import { useState, useEffect } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { Dropdown } from "../Generic/Dropdown";
import { useNotification } from "../../hooks/useNotification";
import { useChannelContext } from "../../hooks/useChannelContext";
import { useSystemContext } from "../../hooks/useSystemContext";
import { channelApi } from "../../api/channelApi";
import { useWebSocketContext } from "../../hooks/useWebSocketContext";

export const ChannelInfo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [onlineUserCount, setOnlineUserCount] = useState(0);
  const { state: wsState } = useWebSocketContext();

  const {
    state: { username, token },
  } = useAuthContext();
  const { showError } = useNotification();
  const { currentChannel } = useSystemContext().state;
  const { members } = useChannelContext().state;

  // Get channel connection status, default to false if context is unavailable
  const channelConnected = wsState ? wsState.channelConnected : false;

  const isAdmin = members && Object.values(members).some((member) => member.username === username && member.isAdmin);

  useEffect(() => {
    setOnlineUserCount(members.filter((m) => m.isOnline).length);
  }, [members]);

  // Get sorted members
  const sortedMembers =
    members &&
    Object.values(members).sort((a, b) => {
      if (a.isAdmin === b.isAdmin) return a.username.localeCompare(b.username);
      return a.isAdmin ? -1 : 1;
    });

  const handlePromoteMember = (memberUsername: string) => {
    // Ensure currentChannel and token exist
    if (!currentChannel || !token) {
      showError("Cannot promote member: channel or auth token missing.");
      return;
    }

    // API Call first
    channelApi.updateMemberRole(currentChannel.name, memberUsername, token, true).catch((error) => {
      console.error("Failed to promote member:", error);
      showError(`Failed to promote ${memberUsername}. Please try again.`);
    });
  };

  const handleDemoteMember = (memberUsername: string) => {
    // Ensure currentChannel and token exist
    if (!currentChannel || !token) {
      showError("Cannot demote member: channel or auth token missing.");
      return;
    }

    // API Call first
    channelApi.updateMemberRole(currentChannel.name, memberUsername, token, false).catch((error) => {
      console.error("Failed to demote member:", error);
      showError(`Failed to demote ${memberUsername}. Please try again.`);
    });
  };

  const membersList = sortedMembers && (
    <>
      {sortedMembers.map((member) => {
        // Check if user is online based on activeMembers from channel context
        const isUserOnline = members.some((m) => m.username === member.username && m.isOnline);

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

            {isAdmin && member.username !== username && member.username !== currentChannel?.createdBy && (
              <button
                onClick={() =>
                  member.isAdmin ? handleDemoteMember(member.username) : handlePromoteMember(member.username)
                }
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
      {/* Overlay when not connected */}
      {!channelConnected && (
        <div className="absolute inset-0 bg-surface-dark/80 flex items-center justify-center z-10">
          <span className="text-text-light/70 text-sm animate-pulse">Loading channel info...</span>
          {/* Optionally add a spinner component here */}
        </div>
      )}

      <div className="flex flex-col p-4 border-b border-primary/20 min-h-16 w-full">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full whitespace-nowrap">
            <Dropdown
              trigger={
                <span>
                  {members.length} {members.length === 1 ? "Member" : "Members"}
                </span>
              }
              isOpenExternal={isOpen}
              setIsOpenExternal={setIsOpen}
              position="left"
            >
              {membersList}
            </Dropdown>
            <h2 className="flex font-medium text-text-light truncate">{currentChannel?.name}</h2>
            <span className="flex ml-2 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
              {onlineUserCount} online
            </span>
          </div>

          <div
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="cursor-pointer group w-full select-none overflow-hidden"
          >
            <p
              className={`text-xs text-text-light/50 overflow-hidden ${
                isDescriptionExpanded ? "whitespace-normal break-words" : "truncate"
              } text-left group-hover:text-primary/70 transition-colors w-full max-w-full`}
            >
              {currentChannel?.description || "No description provided"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
