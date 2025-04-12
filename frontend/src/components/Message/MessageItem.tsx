import { useState } from "react";
import { IncomingMessage, MemberUpdateAction, MessageType } from "../../types/interfaces";
import helpers from "../../utils/helpers";
import { Modal } from "../Generic/Modal";
import axios from "axios";
import { useAuthContext } from "../../hooks/useAuthContext";

type MessageItemProps = {
  message: IncomingMessage;
  onImageLoad?: () => void;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, onImageLoad }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { token, username } = useAuthContext().state;

  const myMessage = username == message.username;

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
            className={`px-3 py-1 rounded-lg break-words text-sm overflow-anywhere ${
              myMessage ? "bg-secondary/60 text-text-light" : "bg-secondary-dark/40 text-text-light"
            }`}
          >
            {linkify(message.content.text ?? "")}
          </p>
        );
      case MessageType.MemberUpdate:
        // Ensure memberUpdate is defined
        if (!memberUpdate) return null;

        // Handle specific member update actions
        switch (memberUpdate.action) {
          case MemberUpdateAction.RoleChanged:
            return (
              <div className="px-3 py-1.5 text-primary/90 italic text-sm text-center">
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
              <div className="px-3 py-1.5 text-secondary-light italic text-sm text-center">
                <p>{memberUpdate.username} became a member of the channel.</p>
              </div>
            );
          default:
            console.error("Unknown member update action:", memberUpdate.action);
            return null;
        }

      case MessageType.Image:
        return (
          <div className="space-y-1">
            <div className={`flex ${myMessage ? "justify-end" : "justify-start"}`}>
              <img
                src={cleanAuthPath(message.content.thumbnailUrl ?? "")}
                alt="thumbnail"
                onClick={() => setIsOpen(true)}
                className="max-w-[400px] max-h-[300px] object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                crossOrigin="use-credentials"
                onLoad={onImageLoad}
              />
            </div>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Image Preview" className="w-auto p-2">
              <div className="flex flex-col items-center justify-center h-full space-y-2">
                <img
                  src={cleanAuthPath(message.content.fileUrl ?? "")}
                  alt="full-size"
                  className="max-w-full max-h-[calc(90vh-170px)] object-contain rounded-lg"
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
                className={`px-3 py-1 rounded-lg break-words text-sm overflow-anywhere ${
                  myMessage ? "bg-secondary/60 text-text-light" : "bg-secondary-dark/40 text-text-light"
                }`}
              >
                {linkify(message.content.text)}
              </p>
            )}
          </div>
        );
    }
  };

  if (message.type == MessageType.MemberUpdate || message.type == MessageType.UserStatus) {
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

// Helper function to convert URLs in text to clickable links
const linkify = (text: string): React.ReactNode[] => {
  // Regex Explanation:
  // 1. (\bhttps?:\/\/[^\s<>\"\']+): Matches http:// or https:// followed by non-space/angle/quote chars.
  // 2. (\bwww\.[^\s<>\"\']+): Matches www. followed by non-space/angle/quote chars.
  // 3. (\b[a-zA-Z0-9.-]+\.(?:com|org|net|io|co|dev|app|ai|sh|xyz|me|tech|info|link)\b(?:\/[^\s<>\"\']*)?): Matches domain.tld patterns with common TLDs, optionally followed by a path (excluding non-space/angle/quote chars).
  const urlRegex =
    /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-zA-Z0-9.-]+\.(?:com|org|net|io|co|dev|app|ai|sh|xyz|me|tech|info|link)\b(?:\/[^\s<>"']*)?)/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedString = match[0]; // Use const as it's not reassigned here

    // Add the text segment before the current match
    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    // Process the matched URL
    let displayUrl = matchedString;
    let href = matchedString;

    // Trim common trailing punctuation (,.!?;:) that aren't part of the URL path itself
    // Example: "Check https://example.com/." should link to "https://example.com/"
    const trailingPunctuationRegex = /[.,!?;:]+$/;
    const punctuationMatch = displayUrl.match(trailingPunctuationRegex);

    if (punctuationMatch) {
      // Ensure the character *before* the punctuation is not part of the URL path (e.g., not alphanumeric or slash)
      const charBeforePunctIdx = displayUrl.lastIndexOf(punctuationMatch[0]) - 1;
      if (charBeforePunctIdx >= 0) {
        const charBeforePunct = displayUrl[charBeforePunctIdx];
        if (!/[\\w\\/]/.test(charBeforePunct)) {
          displayUrl = displayUrl.substring(0, displayUrl.lastIndexOf(punctuationMatch[0]));
          href = displayUrl; // Update href to match displayed text
        }
      }
      // If punctuationMatch exists but the condition above wasn't met, it means the punctuation is likely part of the URL
    }

    // Prepend 'http://' if the URL doesn't start with http:// or https://
    if (!/^https?:\/\//i.test(href)) {
      href = `http://${href}`;
    }

    // Add the clickable link element
    elements.push(
      <a
        key={`${href}-${matchIndex}`} // Unique key using href and index
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-black hover:underline break-all font-semibold" // Retain user's style
        onClick={(e) => e.stopPropagation()} // Prevent message selection if clicking link
      >
        {displayUrl} {/* Display the (potentially trimmed) URL */}
      </a>
    );

    // Update the index for the next segment
    lastIndex = urlRegex.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  // If no matches were found, return the original text wrapped in an array
  return elements.length > 0 ? elements : [text];
};
