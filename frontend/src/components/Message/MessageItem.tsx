import { useContext, useState } from "react";
import { IncomingMessage, MemberUpdateAction, MessageType } from "../../types/interfaces";
import helpers from "../../utils/helpers";
import { Modal } from "../Generic/Modal";
import axios from "axios";
import { AuthContext } from "../../contexts/authContext";

type MessageItemProps = {
  message: IncomingMessage;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) throw new Error("AuthContext not found");
  const token = authContext.state.token;
  const myMessage = authContext.state.username == message.username;

  const cleanAuthPath = (path: string) => {
    if (!path) return "";
    return `${path.replace(/^\/*(files\/)?/, "")}?token=${token}`;
  };

  const handleDownload = async (url: string) => {
    try {
      setIsDownloading(true);

      const response = await axios.get(cleanAuthPath(url), {
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
    // Get the member update if available
    const memberUpdate = message.content.memberUpdate;

    switch (message.type) {
      case MessageType.Text:
        return (
          <p
            className={`px-3 py-1 rounded-lg break-words text-sm ${
              myMessage ? "bg-secondary/60 text-text-light" : "bg-secondary-dark/40 text-text-light"
            }`}
          >
            {message.content.text}
          </p>
        );
      case MessageType.MemberUpdate:
        // Ensure memberUpdate is defined
        if (!memberUpdate) return null;

        // Handle specific member update actions
        switch (memberUpdate.action) {
          case MemberUpdateAction.RoleChanged:
            return (
              <div className="px-3 py-1.5 text-text-light italic text-xs text-center">
                {memberUpdate.isAdmin ? (
                  <p>
                    {message.username} made {memberUpdate.username} an admin.
                  </p>
                ) : (
                  <p>
                    {message.username} removed {memberUpdate.username}'s admin status.
                  </p>
                )}
              </div>
            );
          case MemberUpdateAction.Added:
            return (
              <div className="px-3 py-1.5 text-text-light italic text-xs text-center">
                <p>{memberUpdate.username} joined the channel.</p>
              </div>
            );
          default:
            console.error("Unknown member update action:", memberUpdate.action);
            return null;
        }

      case MessageType.Image:
        return (
          <div className="space-y-1">
            <img
              src={cleanAuthPath(message.content.thumbnailUrl ?? "")}
              alt="thumbnail"
              onClick={() => setIsOpen(true)}
              className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              crossOrigin="use-credentials"
            />
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Image Preview" className="w-auto">
              <div className="flex flex-col items-center space-y-4">
                <img
                  src={cleanAuthPath(message.content.fileUrl ?? "")}
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
                className={`px-3 py-1 rounded-lg ${
                  myMessage ? "bg-secondary/60 text-text-light" : "bg-secondary-dark/40 text-text-light"
                }`}
              >
                {message.content.text}
              </p>
            )}
          </div>
        );
    }
  };

  if (message.type == MessageType.MemberUpdate) {
    return <div>{renderContent()}</div>;
  } else {
    return (
      <div className={`flex flex-col ${myMessage ? "items-end" : "items-start"} gap-0.5`}>
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-medium text-text-light/80">{message.username}</span>
          <span className="text-xs italic text-text-light/50">{helpers.formatTimestamp(message.timestamp)}</span>
        </div>
        <div className="max-w-[80%]">{renderContent()}</div>
      </div>
    );
  }
};
