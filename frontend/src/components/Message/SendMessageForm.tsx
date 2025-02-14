import { FormEvent, useContext, useRef, useState } from "react";
import { OutgoingMessage, MessageType } from "../../types/interfaces";
import { ChatContext } from "../../contexts/chatContext";
import { BASE_URL } from "../../utils/constants";
import { AuthContext } from "../../contexts/authContext";
import axios from "axios";

type SendMessageFormProps = {
  onSend: (message: OutgoingMessage) => void;
};

export const SendMessageForm = ({ onSend }: SendMessageFormProps) => {
  const chatContext = useContext(ChatContext);
  const authContext = useContext(AuthContext);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);

  if (!chatContext || !authContext) return null;

  const {
    state: { currentChannel },
  } = chatContext;

  const {
    state: { token },
  } = authContext;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  // const handleDragLeave = (e: React.DragEvent) => {
  //   e.preventDefault();
  //   setIsDragging(false);
  // };

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

  const handleFileUpload = async (file: File, message: string) => {
    if (!currentChannel) return;

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("channelName", currentChannel);

    try {
      const response = await axios.post(`${BASE_URL}/upload`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        const outgoingMessage: OutgoingMessage = {
          channelName: currentChannel,
          type: MessageType.Image,
          content: {
            text: message,
            fileUrl: response.data.data.imagePath,
            thumbnailUrl: response.data.data.thumbnailPath,
          },
        };
        onSend(outgoingMessage);

        // Clear inputs
        if (messageInputRef.current) messageInputRef.current.value = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentChannel) return;

    const message = messageInputRef.current?.value || "";
    const file = draggedFile || fileInputRef.current?.files?.[0] || null;

    if (file) {
      await handleFileUpload(file, message);
    } else if (message.trim()) {
      const outgoingMessage: OutgoingMessage = {
        channelName: currentChannel,
        type: MessageType.Text,
        content: { text: message },
      };
      onSend(outgoingMessage);
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
