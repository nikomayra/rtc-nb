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

export default { formatTimestamp };
