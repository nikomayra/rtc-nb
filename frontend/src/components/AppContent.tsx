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
    <div className="flex h-screen w-full bg-surface-dark text-text-light p-4">
      <div className="basis-[15%] bg-surface-light rounded-lg p-4 mr-4 shadow-md">
        <ChannelList />
      </div>
      <div className="flex flex-1 gap-4">
        {chatContext.state.currentChannel && (
          <>
            <div className="basis-[35%] bg-surface-light rounded-lg p-4 shadow-md">
              <MessageList />
            </div>
            <div className="basis-[50%] bg-surface-light rounded-lg p-4 shadow-md">
              <SketchContainer />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
