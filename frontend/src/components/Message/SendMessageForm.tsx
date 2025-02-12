import { FormEvent, useContext, useRef } from "react";
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

  if (!chatContext || !authContext) return null;

  const {
    state: { currentChannel },
  } = chatContext;

  const {
    state: { token },
  } = authContext;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentChannel) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get("message") as string;
    const file = formData.get("file") as File;

    console.log("📜Form submission:", {
      hasFile: !!file,
      fileSize: file?.size,
      fileName: file?.name,
      fileType: file?.type,
      message,
      formDataEntries: Array.from(formData.entries()),
    });

    if (file && file.size > 0) {
      console.log("🔍 Debug upload:", {
        url: `${BASE_URL}/upload`,
        fileDetails: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
      });
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("channelName", currentChannel);

      console.log("🔍 Raw FormData:", {
        rawData: Array.from(uploadFormData.entries()).map(([key, value]) => ({
          key,
          value:
            value instanceof File
              ? {
                  name: value.name,
                  size: value.size,
                  type: value.type,
                  lastModified: value.lastModified,
                }
              : value,
        })),
      });

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
      <form onSubmit={handleSubmit} id="send-message-form">
        <input
          type="file"
          name="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={(e) => {
            console.log("File selected:", {
              file: e.target.files?.[0],
              name: e.target.files?.[0]?.name,
              type: e.target.files?.[0]?.type,
              size: e.target.files?.[0]?.size,
            });
          }}
        />
        <input type="text" name="message" ref={messageInputRef} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};
