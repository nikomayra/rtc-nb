import { AuthContainer } from "./Auth/AuthContainer";
import { ChannelList } from "./Channel/ChannelList";
import { MessageList } from "./Message/MessageList";
import { useAuthContext } from "../hooks/useAuthContext";
import { SketchContainer } from "./Sketch/SketchContainer";
import { ChatContext } from "../contexts/systemContext";
import { useContext } from "react";
import { ChannelInfo } from "./Channel/ChannelInfo";
import { NotificationTest } from "./NotificationTest";

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
    <div className="flex h-screen w-screen bg-surface-dark text-text-light p-4 overflow-hidden">
      {/* Always show the notification test panel for development */}
      <NotificationTest />

      <aside className="w-[22%] bg-surface-light rounded-lg p-4 mr-4 shadow-md">
        <ChannelList />
      </aside>
      <div className="flex gap-4 w-[78%]">
        {chatContext.state.currentChannel && (
          <>
            <div className="w-[40%] bg-surface-light rounded-lg shadow-md overflow-hidden flex flex-col">
              <div className="flex-none">
                <ChannelInfo
                  channel={chatContext.state.channels.find((c) => c.name === chatContext.state.currentChannel)!}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <MessageList />
              </div>
            </div>
            <div className="w-[60%] min-w-0 bg-surface-light rounded-lg shadow-md overflow-hidden mr-4">
              <SketchContainer />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
