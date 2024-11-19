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

// function App() {
//   return (
//     <AuthProvider>
//       <ChannelProvider>
//         <MessageProvider>
//           <div className="app-container">
//             <ChannelSection />
//             <MessageSection />
//           </div>
//         </MessageProvider>
//       </ChannelProvider>
//     </AuthProvider>
//   );
// }

// // Separate components for each feature
// const ChannelSection = () => {
//   const { channels, joinChannel } = useChannelContext();
//   return <ChannelList channels={channels} onJoin={joinChannel} />;
// };

// const MessageSection = () => {
//   const { messages, sendMessage } = useMessageContext();
//   return <MessageList messages={messages} onSend={sendMessage} />;
// };
