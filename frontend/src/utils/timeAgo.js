// Utility to convert a Date / ISO string into a compact relative time string.
// Examples: "Just now", "1min ago", "10hr ago", "1day ago",
//           "2 days ago", "2weeks ago", "1month ago".
export function timeAgo(input) {
  if (input === null || input === undefined || input === "") return "";

  let date;
  if (input instanceof Date) {
    date = input;
  } else {
    date = new Date(input);
  }

  // If we couldn't parse a real date, fall back to the raw string
  // (it may already be a relative string like "2h ago").
  if (isNaN(date.getTime())) {
    return typeof input === "string" ? input : "";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) return "Just now";   // future / clock skew
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}hr ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return diffDay === 1 ? "1day ago" : `${diffDay} days ago`;
  }

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) {
    return `${diffWeek}weeks ago`;
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return diffMonth === 1 ? "1month ago" : `${diffMonth}months ago`;
  }

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}year${diffYear > 1 ? "s" : ""} ago`;
}

export default timeAgo;