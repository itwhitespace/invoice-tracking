import { TimeFrameItem, SavedRecord } from "./types";

// Parses a free-text duration like "3 Weeks", "1 Month", "10 Days", or the
// Thai equivalents into a whole number of weeks. A bare number with no unit
// (e.g. "4", as AI extraction sometimes returns) is read as weeks. Returns 0
// when the text can't be parsed (e.g. still blank) or the duration is 0.
export function parseWeeksFromDuration(duration: string): number {
  if (!duration) return 0;
  const text = String(duration);
  // Prefer a number that carries a unit (so "2-3 Weeks" reads as 3), then
  // fall back to the first bare number.
  const match =
    text.match(/(\d+(?:\.\d+)?)\s*(week|month|day|wk|สัปดาห์|เดือน|วัน)/i) ||
    text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (!(num > 0)) return 0;
  const unit = (match[2] || "week").toLowerCase();
  if (unit.startsWith("month") || unit.startsWith("เดือน")) return Math.max(1, Math.round(num * 4));
  if (unit.startsWith("day") || unit.startsWith("วัน")) return Math.max(1, Math.round(num / 7));
  return Math.max(1, Math.round(num));
}

// Total project duration in weeks, summed across every Time Frame phase —
// used to build the "which week is this payment collected in" dropdown.
export function getTotalWeeks(timeFrames: TimeFrameItem[]): number {
  return (timeFrames || []).reduce((sum, tf) => sum + parseWeeksFromDuration(tf.duration), 0);
}

// Project Timeframes is the source of truth for a project's duration — sum
// its weeks live rather than trusting the stored totalDesignDuration text,
// which can go stale (e.g. still reading "9" after the Timeframes were
// edited up to 100 weeks) since nothing keeps it in sync automatically.
// Only records with no timeframe rows at all fall back to that stored text.
export function formatProjectDuration(rec: SavedRecord): string {
  const weeks = getTotalWeeks(rec.timeFrames || []);
  if (weeks > 0) return `${weeks} Weeks`;
  return rec.totalDesignDuration || "-";
}
