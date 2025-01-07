import { useState } from "react";
import { IncomingMessage, MessageType } from "../../types/interfaces";
import helpers from "../../utils/helpers";
import { Modal } from "../Generic/Modal";

type MessageItemProps = {
  message: IncomingMessage;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const storedUsername = sessionStorage.getItem("username");
  const myMessage = storedUsername == message.username;
  const [isOpen, setIsOpen] = useState(false);

  const renderContent = () => {
    switch (message.type) {
      case MessageType.Text:
        return <p className="message-content">{message.content.text}</p>;
      case MessageType.Image:
        return (
          <div className="message-content">
            <img
              src={helpers.getFullURL(message.content.thumbnailUrl ?? "")}
              alt="thumbnail"
              onClick={() => setIsOpen(true)}
              className="message-thumbnail"
            />
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Image Preview">
              <img src={helpers.getFullURL(message.content.fileUrl ?? "")} alt="full-size" />
              {/* TODO: Add download button */}
            </Modal>
            {message.content.text && <p>{message.content.text}</p>}
          </div>
        );
    }
  };

  return (
    <div className={`message-item ${myMessage ? "my-message" : ""}`}>
      <div className="message-header">
        <span className="message-username">{message.username} </span>
        <span className="message-timestamp">{helpers.formatTimestamp(message.timestamp)}</span>
      </div>
      {renderContent()}
    </div>
  );
};
