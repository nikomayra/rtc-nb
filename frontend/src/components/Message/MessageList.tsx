import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";
import { SendMessageForm } from "./SendMessageForm";
import { useSystemContext } from "../../hooks/useSystemContext";
import { useChannelContext } from "../../hooks/useChannelContext";
import { useWebSocketContext } from "../../hooks/useWebSocketContext";

export const MessageList = () => {
  const { state: systemState } = useSystemContext();
  const { state: channelState } = useChannelContext();
  const { state: wsState } = useWebSocketContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelConnected = wsState ? wsState.channelConnected : false;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [systemState.currentChannel, channelState.messages]);

  if (!systemState.currentChannel) {
    return <div className="flex-1 flex items-center justify-center text-text-light/50">No channel selected</div>;
  }

  return (
    <div className="flex flex-col h-full relative">
      {!channelConnected && (
        <div className="absolute inset-0 bg-surface-dark/80 flex items-center justify-center z-10">
          <span className="text-text-light/70 text-sm animate-pulse">Connecting to channel...</span>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto flex flex-col gap-2 pr-2 mb-2
          scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark 
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        {channelState.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div>
        <SendMessageForm />
      </div>
    </div>
  );
};
