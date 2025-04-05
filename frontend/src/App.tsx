import { AuthProvider } from "./providers/AuthProvider";
import { AppContent } from "./components/AppContent";
import { NotificationProvider } from "./providers/NotificationProvider";
import { SystemProvider } from "./providers/SystemProvider";
import { ChannelProvider } from "./providers/ChannelProvider";
import { SketchProvider } from "./providers/SketchProvider";
import { WebSocketProvider } from "./providers/WebSocketProvider";

function App() {
  if (import.meta.env.DEV) {
    console.log("[App] Rendering App component.");
  }
  return (
    <NotificationProvider>
      <AuthProvider>
        <WebSocketProvider>
          <SystemProvider>
            <ChannelProvider>
              <SketchProvider>
                <AppContent />
              </SketchProvider>
            </ChannelProvider>
          </SystemProvider>
        </WebSocketProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
