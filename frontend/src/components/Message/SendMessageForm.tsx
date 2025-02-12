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

  if (!chatContext || !authContext) return null;

  const {
    state: { currentChannel },
  } = chatContext;

  const {
    state: { token },
  } = authContext;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
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
            text: messageInputRef.current?.value || "",
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
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get("message") as string;
    const file = formData.get("file") as File;

    if (file && file.size > 0) {
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
          // Then send websocket message with the URLs
          const outgoingMessage: OutgoingMessage = {
            channelName: currentChannel,
            type: MessageType.Image,
            content: {
              text: message, // Optional message
              fileUrl: response.data.data.imagePath,
              thumbnailUrl: response.data.data.thumbnailPath,
            },
          };
          onSend(outgoingMessage);
        }
      } catch (err) {
        console.error("Upload failed with error:", err);
      }
    } else {
      // Regular text message
      const outgoingMessage: OutgoingMessage = {
        channelName: currentChannel,
        type: MessageType.Text,
        content: { text: message },
      };
      onSend(outgoingMessage);
    }

    // Clear form
    if (messageInputRef.current) {
      messageInputRef.current.value = "";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        id="send-message-form"
        className="flex gap-2 p-2 bg-surface-dark"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-none p-2 rounded-lg hover:bg-primary/20 transition-colors"
        >
          📷
        </button>
        <input
          type="file"
          name="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />
        <input
          type="text"
          name="message"
          ref={messageInputRef}
          className="flex-1 bg-surface-light/10 rounded-lg px-3 py-2 text-text-light placeholder:text-text-light/50"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          className="flex-none px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg text-white transition-colors"
        >
          Send
        </button>
      </form>
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <p className="text-text-light text-lg">Drop image here</p>
        </div>
      )}
    </div>
  );
};
