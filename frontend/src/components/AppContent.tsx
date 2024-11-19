import { AuthContainer } from './Auth/AuthContainer';
import { ChannelList } from './Channel/ChannelList';
import { MessageList } from './Message/MessageList';
import { useAuthContext } from '../hooks/useAuthContext';

export const AppContent = () => {
  const { isLoggedIn } = useAuthContext();

  if (!isLoggedIn) {
    return <AuthContainer />;
  }

  return (
    <div className='app-container'>
      <ChannelList />
      <MessageList />
    </div>
  );
};
