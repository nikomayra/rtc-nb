import { AuthContainer } from './Auth/AuthContainer';
import { ChannelList } from './Channel/ChannelList';
import { MessageList } from './Message/MessageList';
import { useAuthContext } from '../hooks/useAuthContext';
import { SketchContainer } from './Sketch/SketchContainer';

export const AppContent = () => {
  const {
    state: { isLoggedIn },
  } = useAuthContext();

  if (!isLoggedIn) {
    return <AuthContainer />;
  }

  return (
    <div className='app-container'>
      <ChannelList />
      <MessageList />
      <SketchContainer />
    </div>
  );
};
