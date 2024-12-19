import { API_URL } from './constants';

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);

  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
  });
};

const getFullURL = (partialURL: string) => {
  if (partialURL.startsWith('http')) return partialURL;
  return `${API_URL}${partialURL}`;
};

export default { formatTimestamp, getFullURL };
