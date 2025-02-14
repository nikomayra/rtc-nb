import { useState, useRef, useEffect } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { Channel } from "../../types/interfaces";
import { BASE_URL } from "../../utils/constants";
import axios from "axios";

interface ChannelInfoProps {
  channel: Channel;
}

export const ChannelInfo = ({ channel }: ChannelInfoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    state: { username, token },
  } = useAuthContext();

  const isAdmin = Object.values(channel.members).some((member) => member.username === username && member.isAdmin);

  const sortedMembers = Object.values(channel.members).sort((a, b) => {
    if (a.isAdmin === b.isAdmin) return a.username.localeCompare(b.username);
    return a.isAdmin ? -1 : 1;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRoleToggle = async (memberUsername: string, newIsAdmin: boolean) => {
    try {
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
      if (!response.data.success) {
        console.error("Failed to update role:", response.data.error);
      }
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-primary/20">
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
        <h2 className="font-medium text-text-light truncate">{channel.name}</h2>
        <span className="text-xs text-text-light/50 flex-none">{Object.keys(channel.members).length} members</span>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm 
            bg-surface-dark/50 hover:bg-surface-dark text-text-light/70 
            hover:text-primary transition-colors"
        >
          <span>Members</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-64 bg-surface-light border 
            border-primary/20 rounded-md shadow-md z-50"
          >
            <div
              className="max-h-80 overflow-auto p-2 space-y-1
              scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark"
            >
              {sortedMembers.map((member) => (
                <div
                  key={member.username}
                  className="flex items-center justify-between py-2 px-3 
                    hover:bg-surface-dark/50 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        member.isAdmin ? "bg-primary/10 text-primary" : "bg-surface-dark/50 text-text-light/50"
                      }`}
                    >
                      {member.isAdmin ? "admin" : "user"}
                    </span>
                    <span className="text-sm truncate flex-1">{member.username}</span>
                  </div>

                  {isAdmin && member.username !== username && (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
