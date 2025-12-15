import { formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from "date-fns";

/**
 * Formats a date/timestamp to a human-readable relative time string.
 * Examples: "just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago"
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Handle invalid dates
  if (isNaN(dateObj.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const minutesAgo = differenceInMinutes(now, dateObj);

  // Less than 1 minute ago
  if (minutesAgo < 1) {
    return "just now";
  }

  // Less than 60 minutes ago - show minutes
  if (minutesAgo < 60) {
    return `${minutesAgo} minute${minutesAgo === 1 ? "" : "s"} ago`;
  }

  // Today - use formatDistanceToNow for hours
  if (isToday(dateObj)) {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }

  // Yesterday
  if (isYesterday(dateObj)) {
    return "Yesterday";
  }

  // Older - use formatDistanceToNow for days/weeks/months
  return formatDistanceToNow(dateObj, { addSuffix: true });
}
