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
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const channelConnected = wsState ? wsState.channelConnected : false;

  // Function to handle image load and re-scroll if necessary
  const handleImageLoad = () => {
    const container = messageContainerRef.current;
    if (container) {
      // Use a small tolerance. If we are further than this from the bottom after
      // an image loads, it means the scrollHeight changed significantly.
      const tolerance = 10; // pixels
      const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + tolerance;

      // If not near bottom after image load, scroll smoothly
      if (!isNearBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  };

  useEffect(() => {
    const container = messageContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [channelState.messages]);

  useEffect(() => {
    const container = messageContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [systemState.currentChannel]);

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
        ref={messageContainerRef}
        className="flex-1 overflow-y-scroll flex flex-col gap-2 pr-2 mb-2
          scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark 
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        {channelState.messages.map((message) => (
          <MessageItem key={message.id} message={message} onImageLoad={handleImageLoad} />
        ))}
      </div>
      <div>
        <SendMessageForm />
      </div>
    </div>
  );
};
