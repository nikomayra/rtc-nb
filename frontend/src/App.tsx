import { AuthProvider } from "./components/Providers/AuthProvider";
import { AppContent } from "./components/AppContent";
import { ChatProvider } from "./components/Providers/ChatProvider";
import { WebSocketProvider } from "./components/Providers/WebSocketProvider";

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
