import { AuthProvider } from "./components/Providers/AuthProvider";
import { AppContent } from "./components/AppContent";
import { ChatProvider } from "./components/Providers/ChatProvider";
import { WebSocketProvider } from "./components/Providers/WebSocketProvider";
import { SketchProvider } from "./components/Providers/SketchProvider";
import { NotificationProvider } from "./components/Providers/NotificationProvider";

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <WebSocketProvider>
          <ChatProvider>
            <SketchProvider>
              <AppContent />
            </SketchProvider>
          </ChatProvider>
        </WebSocketProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
