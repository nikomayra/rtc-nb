import { AuthContainer } from "./Auth/AuthContainer";
import { ChannelList } from "./Channel/ChannelList";
import { MessageList } from "./Message/MessageList";
import { useAuthContext } from "../hooks/useAuthContext";
import { SketchContainer } from "./Sketch/SketchContainer";
import { ChannelInfo } from "./Channel/ChannelInfo";
// import { NotificationTest } from "./NotificationTest";
import { useSystemContext } from "../hooks/useSystemContext";
import { useSystemSocket } from "../hooks/useSystemSocket";
import { useChannelSocket } from "../hooks/useChannelSocket";

export const AppContent = () => {
  const {
    state: { isLoggedIn },
  } = useAuthContext();

  const systemContext = useSystemContext();

  // Initialize WebSocket connections and handlers
  useSystemSocket();
  useChannelSocket();

  if (!isLoggedIn) {
    return <AuthContainer />;
  }

  return (
    <div className="flex h-screen w-screen bg-surface-dark text-text-light p-4 overflow-hidden">
      {/* Always show the notification test panel for development */}
      {/* <NotificationTest /> */}

      <aside className="w-[22%] bg-surface-light rounded-lg p-4 mr-4 shadow-md">
        <ChannelList />
      </aside>
      <div className="flex gap-4 w-[78%]">
        {systemContext.state.currentChannel &&
        systemContext.state.channels.find((c) => c.name === systemContext.state.currentChannel?.name) ? (
          <>
            <div className="w-[40%] bg-surface-light rounded-lg shadow-md overflow-hidden flex flex-col">
              <div className="flex-none">
                <ChannelInfo />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <MessageList />
              </div>
            </div>
            <div className="w-[60%] min-w-0 bg-surface-light rounded-lg shadow-md overflow-hidden mr-4">
              <SketchContainer />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center p-6 bg-surface-dark/20 rounded-lg border border-primary/10 max-w-md">
              <h3 className="text-lg font-medium text-text-light mb-3">No Channel Selected</h3>
              <p className="text-sm text-text-light/70 mb-4">Select an existing channel from the list.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
