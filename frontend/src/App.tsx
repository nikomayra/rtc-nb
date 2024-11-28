import { AuthProvider } from './components/Providers/AuthProvider';
import { AppContent } from './components/AppContent';
import { ChatProvider } from './components/Providers/ChatProvider';

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
