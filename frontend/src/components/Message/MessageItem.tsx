import { useContext, useState } from "react";
import { IncomingMessage, MessageType } from "../../types/interfaces";
import helpers from "../../utils/helpers";
import { Modal } from "../Generic/Modal";
import axios from "axios";
import { AuthContext } from "../../contexts/authContext";
import { BASE_URL } from "../../utils/constants";

type MessageItemProps = {
  message: IncomingMessage;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const storedUsername = sessionStorage.getItem("username");
  const myMessage = storedUsername == message.username;
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) throw new Error("AuthContext not found");
  const token = authContext.state.token;

  const handleDownload = async (url: string) => {
    try {
      setIsDownloading(true);

      const cleanPath = url.replace(/^\/*(files\/)?/, "");

      const response = await axios.get(`${BASE_URL}/files/${cleanPath}?token=${token}`, {
        responseType: "blob",
      });

      const link = document.createElement("a");
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      link.href = blobUrl;
      link.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setIsDownloading(false);
    } catch (error) {
      console.error("Download failed:", error);
      setIsDownloading(false);
    }
  };

  const renderContent = () => {
    switch (message.type) {
      case MessageType.Text:
        return (
          <p
            className={`px-3 py-1.5 rounded-lg break-words ${
              myMessage ? "bg-secondary text-text-light" : "bg-secondary-dark text-text-light"
            }`}
          >
            {message.content.text}
          </p>
        );

      case MessageType.Image:
        return (
          <div className="space-y-1">
            <img
              src={helpers.getFullURL(message.content.thumbnailUrl ?? "")}
              alt="thumbnail"
              onClick={() => setIsOpen(true)}
              className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              crossOrigin="use-credentials"
            />
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Image Preview" className="w-auto">
              <div className="flex flex-col items-center space-y-4">
                <img
                  src={helpers.getFullURL(message.content.fileUrl ?? "")}
                  alt="full-size"
                  className="max-w-full max-h-[calc(70vh-8rem)] object-contain rounded-lg"
                  crossOrigin="use-credentials"
                />
                <button
                  onClick={() => handleDownload(message.content.fileUrl ?? "")}
                  disabled={isDownloading}
                  className={`w-full px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors
    ${isDownloading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isDownloading ? "Downloading..." : "Download Image"}
                </button>
              </div>
            </Modal>
            {message.content.text && (
              <p
                className={`px-3 py-1.5 rounded-lg ${
                  myMessage ? "bg-secondary text-text-light" : "bg-secondary-dark text-text-light"
                }`}
              >
                {message.content.text}
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col ${myMessage ? "items-end" : "items-start"} gap-0.5`}>
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm font-medium text-text-light/80">{message.username}</span>
        <span className="text-xs italic text-text-light/50">{helpers.formatTimestamp(message.timestamp)}</span>
      </div>
      <div className="max-w-[80%]">{renderContent()}</div>
    </div>
  );
};
