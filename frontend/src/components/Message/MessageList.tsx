import { useContext, useEffect, useRef } from "react";
import { ChatContext } from "../../contexts/chatContext";
import { MessageItem } from "./MessageItem";
import { SendMessageForm } from "./SendMessageForm";

export const MessageList = () => {
  const context = useContext(ChatContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [context?.state.messages, context?.state.currentChannel]);

  if (!context) return null;

  const {
    state: { currentChannel, messages },
  } = context;

  if (!currentChannel) {
    return <div className="flex-1 flex items-center justify-center text-text-light/50">No channel selected</div>;
  }

  const channelMessages = messages[currentChannel] || [];

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-2 pr-2 mb-2
          scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-surface-dark 
          scrollbar-hover:scrollbar-thumb-primary/30"
      >
        {channelMessages.map((message) => (
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
