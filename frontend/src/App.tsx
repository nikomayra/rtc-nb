import { AuthProvider } from './components/Providers/AuthProvider';
import { AppContent } from './components/AppContent';
import { ChannelProvider } from './components/Providers/ChannelProvider';
import { MessageProvider } from './components/Providers/MessageProvider';

function App() {
  return (
    <AuthProvider>
      <ChannelProvider>
        <MessageProvider>
          <AppContent />
        </MessageProvider>
      </ChannelProvider>
    </AuthProvider>
  );
}

export default App;
