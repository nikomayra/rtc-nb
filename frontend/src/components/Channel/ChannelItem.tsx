import React, { useState, useRef, useEffect } from "react";
import { Channel } from "../../types/interfaces";
import { useAuthContext } from "../../hooks/useAuthContext";

type ChannelItemProps = {
  channel: Channel;
  onJoin: (channelName: string, password?: string) => Promise<void>;
  onDelete: (channelName: string) => Promise<void>;
  onLeave: (channelName: string) => Promise<void>;
  currentChannel: string | null;
};

export const ChannelItem: React.FC<ChannelItemProps> = ({ channel, onJoin, onDelete, onLeave, currentChannel }) => {
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const passwordInputRef = useRef<HTMLDivElement>(null);
  const {
    state: { username },
  } = useAuthContext();

  const isActive = currentChannel === channel.name;
  const isOwner = channel.createdBy === username;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (passwordInputRef.current && !passwordInputRef.current.contains(event.target as Node)) {
        setShowPasswordInput(false);
        setPassword("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onJoinCheck = async () => {
    if (channel.isPrivate && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    try {
      await onJoin(channel.name, channel.isPrivate ? password : undefined);
      setShowPasswordInput(false);
      setPassword("");
    } catch (error) {
      console.error("Failed to join channel:", error);
    }
  };

  return (
    <div
      className={`group flex flex-col p-2 rounded-md transition-colors
      ${isActive ? "bg-primary/10 text-primary" : "hover:bg-surface-dark/50 text-text-light"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className={`flex-none w-2 h-2 rounded-full ${channel.isPrivate ? "bg-warning" : "bg-success"}`} />
          <span className="font-medium truncate">{channel.name}</span>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isActive && (
            <button
              onClick={onJoinCheck}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Join
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onLeave(channel.name)}
              className="text-xs px-2 py-1 rounded bg-error/10 text-error hover:bg-error/20 transition-colors"
            >
              Leave
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => onDelete(channel.name)}
              className="text-xs text-error/70 hover:text-error transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {showPasswordInput && channel.isPrivate && (
        <div className="mt-2 flex gap-2" ref={passwordInputRef}>
          <input
            type="password"
            placeholder="Enter channel password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base text-sm py-1 flex-1"
          />
          <button
            onClick={onJoinCheck}
            className="text-xs px-3 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Join
          </button>
        </div>
      )}
    </div>
  );
};
