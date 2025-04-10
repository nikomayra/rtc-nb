import React, { useState, useRef, useEffect } from "react";
import { Channel } from "../../types/interfaces";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useSystemContext } from "../../hooks/useSystemContext";
import { useNotification } from "../../hooks/useNotification";

type ChannelItemProps = {
  channel: Channel;
};

export const ChannelItem: React.FC<ChannelItemProps> = ({ channel }) => {
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const passwordInputRef = useRef<HTMLDivElement>(null);
  const { username } = useAuthContext().state;
  const { showError } = useNotification();
  const systemContext = useSystemContext();

  const { state: systemState, actions: systemActions } = systemContext;

  const isActive = systemState.currentChannel?.name === channel.name;
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

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[ChannelItem] Mounted: ${channel.name}`);
      return () => {
        console.log(`[ChannelItem] Unmounted: ${channel.name}`);
      };
    }
  }, [channel.name]);

  const onJoinCheck = async () => {
    if (channel.isPrivate && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    try {
      await systemActions.joinChannel(channel.name, channel.isPrivate ? password : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join channel unexpectedly";
      showError(message);
      console.error("Failed to join channel:", error);
    }

    setShowPasswordInput(false);
    setPassword("");
  };

  const onLeave = async () => {
    try {
      await systemActions.leaveChannel(channel.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to leave channel unexpectedly";
      showError(message);
      console.error("Failed to leave channel:", error);
    }
  };

  const onDelete = async () => {
    try {
      await systemActions.deleteChannel(channel.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete channel unexpectedly";
      showError(message);
      console.error("Failed to delete channel:", error);
    }
  };

  return (
    <div
      className={`group flex flex-col p-2 rounded-md transition-colors
      ${isActive ? "bg-primary/10 text-primary" : "hover:bg-surface-dark/50 text-text-light"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className={`flex-none w-2 h-2 rounded-full ${channel.isPrivate ? "bg-warning" : "bg-info"}`} />
          <span className="font-medium truncate">{channel.name}</span>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isActive && (
            <button
              onClick={onJoinCheck}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={showPasswordInput && channel.isPrivate}
            >
              Join
            </button>
          )}
          {isActive && (
            <button
              onClick={onLeave}
              className="text-xs px-2 py-1 rounded bg-error/10 text-error hover:bg-error/20 transition-colors"
            >
              Leave
            </button>
          )}
          {isOwner && (
            <button onClick={onDelete} className="text-xs text-error/70 hover:text-error transition-colors">
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
