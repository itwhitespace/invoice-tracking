import { TimeFrameItem } from "./types";

// Parses a free-text duration like "3 Weeks", "1 Month", "10 Days", or the
// Thai equivalents into a whole number of weeks. Returns 0 when the text
// can't be parsed (e.g. still blank).
export function parseWeeksFromDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+(?:\.\d+)?)\s*(week|month|day|สัปดาห์|เดือน|วัน)/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("month") || unit.startsWith("เดือน")) return Math.max(1, Math.round(num * 4));
  if (unit.startsWith("day") || unit.startsWith("วัน")) return Math.max(1, Math.round(num / 7));
  return Math.max(1, Math.round(num));
}

// Total project duration in weeks, summed across every Time Frame phase —
// used to build the "which week is this payment collected in" dropdown.
export function getTotalWeeks(timeFrames: TimeFrameItem[]): number {
  return (timeFrames || []).reduce((sum, tf) => sum + parseWeeksFromDuration(tf.duration), 0);
}
