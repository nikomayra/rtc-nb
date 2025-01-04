import { AuthContainer } from "./Auth/AuthContainer";
import { ChannelList } from "./Channel/ChannelList";
import { MessageList } from "./Message/MessageList";
import { useAuthContext } from "../hooks/useAuthContext";
import { SketchContainer } from "./Sketch/SketchContainer";
import { ChatContext } from "../contexts/chatContext";
import { useContext } from "react";

export const AppContent = () => {
  const {
    state: { isLoggedIn },
  } = useAuthContext();

  const chatContext = useContext(ChatContext);
  if (!chatContext) throw new Error("Chat context not found");

  if (!isLoggedIn) {
    return <AuthContainer />;
  }

  return (
    <div className="app-container">
      <ChannelList />
      {chatContext.state.currentChannel && <MessageList />}
      {chatContext.state.currentChannel && <SketchContainer />}
    </div>
  );
};
