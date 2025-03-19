import { AuthContainer } from "./Auth/AuthContainer";
import { ChannelList } from "./Channel/ChannelList";
import { MessageList } from "./Message/MessageList";
import { useAuthContext } from "../hooks/useAuthContext";
import { SketchContainer } from "./Sketch/SketchContainer";
import { ChatContext } from "../contexts/chatContext";
import { useContext } from "react";
import { ChannelInfo } from "./Channel/ChannelInfo";

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
      <aside className="w-[22%] flex-none bg-surface-light rounded-lg p-4 mr-4 shadow-md">
        <ChannelList />
      </aside>
      <div className="flex flex-1 gap-4">
        {chatContext.state.currentChannel && (
          <>
            <div className="w-[40%] bg-surface-light rounded-lg shadow-md overflow-hidden flex flex-col">
              <ChannelInfo
                channel={chatContext.state.channels.find((c) => c.name === chatContext.state.currentChannel)!}
              />
              <div className="flex-1 overflow-y-auto p-4">
                <MessageList />
              </div>
            </div>
            <div className="flex-1 bg-surface-light rounded-lg p-4 shadow-md">
              <SketchContainer />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
