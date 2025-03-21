import { useState, useContext } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { Channel, MemberUpdateAction, MessageType } from "../../types/interfaces";
import { BASE_URL } from "../../utils/constants";
import axios from "axios";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { Dropdown } from "../Generic/Dropdown";
import { useNotification } from "../../hooks/useNotification";

interface ChannelInfoProps {
  channel: Channel;
}

export const ChannelInfo = ({ channel }: ChannelInfoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const wsContext = useContext(WebSocketContext);
  const {
    state: { username, token },
  } = useAuthContext();
  const { showError, showSuccess } = useNotification();

  if (!wsContext) {
    throw new Error("ChannelInfo must be used within a WebSocketContext");
  }

  const isAdmin = Object.values(channel.members).some((member) => member.username === username && member.isAdmin);

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
      console.log("🎭 Attempting role update:", {
        channelName: channel.name,
        username: memberUsername,
        newIsAdmin,
      });

      const response = await axios.patch(
        `${BASE_URL}/channels/${channel.name}/members/${memberUsername}/role`,
        {
          is_admin: newIsAdmin,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        console.log("🎭 Role update API success:", response.data);
        showSuccess(`${memberUsername} ${newIsAdmin ? "promoted to admin" : "demoted to user"}`);

        const wsMessage = {
          type: MessageType.MemberUpdate,
          channelName: channel.name,
          content: {
            memberUpdate: {
              action: MemberUpdateAction.RoleChanged,
              username: memberUsername,
              isAdmin: newIsAdmin,
            },
          },
        };
        console.log("🎭 Sending websocket message:", wsMessage);
        console.log("🎭 MemberUpdateAction.RoleChanged value:", MemberUpdateAction.RoleChanged);

        wsContext.actions.send(wsMessage);
        console.log("🎭 WebSocket message sent for role change");
      } else {
        const errorMsg = `Failed to update role: ${response.data.error}`;
        console.error(errorMsg);
        showError(errorMsg);
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      showError("Failed to update user role");
    }
  };

  const isOnline = 1 === 1; // TODO: Remove this

  const membersList = (
    <>
      {sortedMembers.map((member) => {
        return (
          <div
            key={member.username}
            className="flex items-center justify-between py-2 px-3 
              hover:bg-surface-dark/50 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"}`}
                title={isOnline ? "Online" : "Offline"}
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
          <div className="flex items-center justify-between w-full">
            <Dropdown
              trigger={<span>Members</span>}
              isOpenExternal={isOpen}
              setIsOpenExternal={setIsOpen}
              position="left"
            >
              {membersList}
            </Dropdown>
            <div className="flex items-center gap-2 min-w-0 mr-2">
              <h2 className="font-medium text-text-light truncate">{channel.name}</h2>
              <span className="text-xs text-text-light/50 flex-none">1 members</span>
            </div>
            {isOnline && (
              <span className="flex ml-2 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full truncate whitespace-nowrap">
                1 online
              </span>
            )}
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
