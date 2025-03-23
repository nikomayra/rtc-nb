import { FormEvent, useContext, useRef, useState } from "react";
import { OutgoingMessage, MessageType } from "../../types/interfaces";
import { ChatContext } from "../../contexts/chatContext";
import { AuthContext } from "../../contexts/authContext";

export const SendMessageForm = () => {
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  if (!chatContext || !authContext) return null;

  const {
    state: { currentChannel },
    actions: { sendMessage, uploadFile },
  } = chatContext;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setDraggedFile(file);
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentChannel) return;

    const message = messageInputRef.current?.value || "";
    const file = draggedFile || fileInputRef.current?.files?.[0] || null;

    if (file) {
      // Use the uploadFile action from the chat context
      await uploadFile(currentChannel, file, message);
    } else if (message.trim()) {
      const outgoingMessage: OutgoingMessage = {
        channelName: currentChannel,
        type: MessageType.Text,
        content: { text: message },
      };
      sendMessage(outgoingMessage);
    }

    // Clear form
    if (messageInputRef.current) messageInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDraggedFile(null);
  };

  return (
    <div className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-1.5 bg-surface-dark rounded-lg w-full min-w-0"
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => setDraggedFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-none px-2.5 py-1.5 text-sm bg-surface-light/10 hover:bg-primary/20 text-text-light/70 rounded-lg transition-colors relative whitespace-nowrap"
        >
          Upload
          {draggedFile && <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-success" />}
        </button>
        <input
          type="text"
          ref={messageInputRef}
          className="flex-1 min-w-0 bg-surface-light/10 rounded-lg px-3 py-1.5 text-text-light placeholder:text-text-light/50"
          placeholder={draggedFile ? "Add a message..." : "Type a message..."}
        />
        <button
          type="submit"
          className="flex-none px-3 py-1.5 bg-primary/70 hover:bg-primary/80 rounded-lg text-white transition-colors whitespace-nowrap"
        >
          Send
        </button>
      </form>
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary/50 border-dashed rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-text-light text-lg">Drop image here</p>
        </div>
      )}
    </div>
  );
};
