import { AuthProvider } from "./components/Providers/AuthProvider";
import { AppContent } from "./components/AppContent";
import { ChatProvider } from "./components/Providers/SystemProvider/";
import { WebSocketProvider } from "./components/Providers/WebSocketProvider";
import { SketchProvider } from "./components/Providers/SketchProvider";
import { NotificationProvider } from "./components/Providers/NotificationProvider";
import { AuthStateListener } from "./components/Providers/AuthStateListener";

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <WebSocketProvider>
          <AuthStateListener />
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
