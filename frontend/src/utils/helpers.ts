const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);

  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  });
};

const formatToHumanReadable = (datetime: string): string => {
  // Create a Date object from the ISO string
  const date = new Date(datetime);

  // Format the date and time into a human-readable format
  const options: Intl.DateTimeFormatOptions = {
    weekday: "narrow", // Day of the week (e.g., "M")
    year: "2-digit", // Full year (e.g., "25")
    month: "2-digit", // Abbreviated month (e.g., "01")
    day: "2-digit", // Day of the month (e.g., "07")
    hour: "2-digit", // Hour in 2-digit format (e.g., "01")
    minute: "2-digit", // Minute in 2-digit format (e.g., "35")
    // timeZoneName: "short", // Timezone abbreviation
    hour12: false, // 24-hour clock format
  };

  // Example input: 2025-01-07T13:35:56.626742Z
  // Example output: T, 01/07/25, 13:35 UTC

  // Use `Intl.DateTimeFormat` to format the Date object
  return date.toLocaleString("en-US", options);
};

export default { formatTimestamp, formatToHumanReadable };
