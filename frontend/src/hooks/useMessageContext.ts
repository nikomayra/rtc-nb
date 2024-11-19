import { useContext } from 'react';
import { MessageContext } from '../contexts/messageContext';

export const useMessageContext = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessageContext must be used within an MessageProvider');
  }
  return context;
};
