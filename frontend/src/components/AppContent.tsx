import { AuthContainer } from './Auth/AuthContainer';
import { ChannelList } from './Channel/ChannelList';
import { MessageList } from './Message/MessageList';
import { useAuthContext } from '../hooks/useAuthContext';

export const AppContent = () => {
  const {
    state: { isLoggedIn },
    actions: { logout },
  } = useAuthContext();

  if (!isLoggedIn) {
    return <AuthContainer />;
  }

  return (
    <div className='app-container'>
      <ChannelList />
      <MessageList />
      <button style={{ position: 'absolute', top: 0, left: 0 }} onClick={logout}>
        Logout
      </button>
    </div>
  );
};
