import { SavedRecord, PaymentStatus } from "./types";
import { getTotalWeeks } from "./timeframe-utils";

// Pure re-implementation of the month/week grid + payment-marker placement
// logic from app/project-roadmap/page.tsx, usable outside a React component
// (e.g. once per department group when building the Excel export). Kept
// separate from the page so the interactive page's tested hooks are never
// touched by export-only changes.

export interface RoadmapMonthConfig {
  name: string; // e.g. "Jul-26"
  year: number;
  monthIndex: number;
  weeksCount: number;
  weeks: string[];
}

export interface RoadmapPaymentMarker {
  col: number;
  ptIdx: number;
  milestone: string;
  amount: number;
  week: number;
  status: PaymentStatus;
  invoiceDate?: string;
}

export interface RoadmapTimelineRow {
  project: SavedRecord;
  hasStage: boolean;
  paymentMarkers: RoadmapPaymentMarker[];
  startCol: number;
  totalSpanCols: number;
  noStartDate: boolean;
  outOfRange: boolean;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getProjectDateRange(proj: SavedRecord): { start: Date; end: Date } | null {
  if (!proj.startDate) return null;
  const start = new Date(`${proj.startDate}T00:00:00`);
  if (isNaN(start.getTime())) return null;

  const totalWeeksWorked = Math.max(1, getTotalWeeks(proj.timeFrames));
  const maxPaymentWeek = (proj.paymentTerms || []).reduce(
    (max, pt) => (pt.paymentWeek ? Math.max(max, pt.paymentWeek) : max),
    0
  );
  const totalWeeks = Math.max(totalWeeksWorked, maxPaymentWeek);

  const end = new Date(start);
  end.setDate(end.getDate() + totalWeeks * 7);
  return { start, end };
}

// Builds one RoadmapMonthConfig per calendar month from (startYear,
// startMonthIndex) through (endYear, endMonthIndex) inclusive.
function buildMonthHeadersInRange(
  startYear: number,
  startMonthIndex: number,
  endYear: number,
  endMonthIndex: number
): RoadmapMonthConfig[] {
  const monthHeaders: RoadmapMonthConfig[] = [];
  let y = startYear;
  let m = startMonthIndex;
  let guard = 0;
  while ((y < endYear || (y === endYear && m <= endMonthIndex)) && guard < 240) {
    const yrShort = String(y).slice(-2);
    const weeksCount = [0, 6, 9].includes(m) ? 5 : 4;
    const weeks = Array.from({ length: weeksCount }, (_, w) => `W${w + 1}`);
    monthHeaders.push({ name: `${MONTH_NAMES[m]}-${yrShort}`, year: y, monthIndex: m, weeksCount, weeks });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    guard++;
  }
  return monthHeaders;
}

// Column offset of a date within an already-built month grid — same
// day-of-month -> synthetic-week mapping used everywhere else.
function colOffsetForDate(monthHeaders: RoadmapMonthConfig[], dateStr?: string): number | null {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  let colOffset = 0;
  for (const mh of monthHeaders) {
    if (date.getFullYear() === mh.year && date.getMonth() === mh.monthIndex) {
      const dayOfMonth = date.getDate();
      const weekInMonth = Math.min(mh.weeksCount, Math.ceil(dayOfMonth / 7));
      return colOffset + (weekInMonth - 1);
    }
    colOffset += mh.weeksCount;
  }
  return null;
}

// Auto-fit month/week headers spanning every given project's full date range.
export function buildMonthHeaders(projects: SavedRecord[]): RoadmapMonthConfig[] {
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  for (const proj of projects) {
    const range = getProjectDateRange(proj);
    if (!range) continue;
    if (!minDate || range.start < minDate) minDate = range.start;
    if (!maxDate || range.end > maxDate) maxDate = range.end;
  }
  if (!minDate || !maxDate) return [];

  let endYear = maxDate.getFullYear();
  let endMonthIndex = maxDate.getMonth();
  let monthHeaders = buildMonthHeadersInRange(minDate.getFullYear(), minDate.getMonth(), endYear, endMonthIndex);

  // The 4-or-5-weeks-per-calendar-month scheme is a stylized approximation,
  // not a literal week count — over a long span it can add up to fewer
  // synthetic columns than a project's real duration needs (Start Date ->
  // furthest payment week), which would otherwise silently clip that
  // project's Stage-All bar and drop its payment markers right at the
  // grid's edge. Keep appending trailing months until every project's own
  // required span actually fits.
  let guard = 0;
  while (guard < 240) {
    const totalCols = monthHeaders.reduce((acc, mh) => acc + mh.weeksCount, 0);
    const needsMore = projects.some((proj) => {
      const startCol = colOffsetForDate(monthHeaders, proj.startDate);
      if (startCol === null) return false;
      const totalWeeksWorked = Math.max(1, getTotalWeeks(proj.timeFrames));
      const maxPaymentWeek = (proj.paymentTerms || []).reduce(
        (max, pt) => (pt.paymentWeek ? Math.max(max, pt.paymentWeek) : max),
        0
      );
      const neededWeeks = Math.max(totalWeeksWorked, maxPaymentWeek);
      return startCol + neededWeeks > totalCols;
    });
    if (!needsMore) break;

    endMonthIndex++;
    if (endMonthIndex > 11) {
      endMonthIndex = 0;
      endYear++;
    }
    monthHeaders = buildMonthHeadersInRange(minDate.getFullYear(), minDate.getMonth(), endYear, endMonthIndex);
    guard++;
  }

  return monthHeaders;
}

// Our fiscal year runs October through September, identified by its start
// year (e.g. 2025 means Oct-2025 through Sep-2026).
export const FISCAL_START_MONTH = 9; // October (0-indexed)

// Given a reference date (defaults to today), returns the start year of
// whichever fiscal year that date falls in — e.g. Sep 2026 resolves to
// 2025 (the Oct-2025-to-Sep-2026 fiscal year that's currently running).
export function getFiscalYearStartYear(referenceDate: Date = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= FISCAL_START_MONTH ? year : year - 1;
}

export function buildFiscalYearMonthHeadersForStartYear(startYear: number): RoadmapMonthConfig[] {
  return buildMonthHeadersInRange(startYear, FISCAL_START_MONTH, startYear + 1, FISCAL_START_MONTH - 1);
}

// Given a reference date (defaults to today), returns the 12 months of
// whichever fiscal year that date falls in.
export function buildFiscalYearMonthHeaders(referenceDate: Date = new Date()): RoadmapMonthConfig[] {
  return buildFiscalYearMonthHeadersForStartYear(getFiscalYearStartYear(referenceDate));
}

// Places the given projects' Stage-All bars and payment markers onto an
// ALREADY-BUILT month grid (rather than deriving its own range) — lets
// several project subsets (e.g. one per department) share one aligned set
// of month columns, which the Summary sheet's per-company blocks need.
export function buildTimelineForMonthHeaders(
  projects: SavedRecord[],
  monthHeaders: RoadmapMonthConfig[]
): {
  timelineRows: RoadmapTimelineRow[];
  monthlyTotals: number[];
  totalGridColumns: number;
} {
  const totalGridColumns = monthHeaders.reduce((acc, m) => acc + m.weeksCount, 0);

  const getStartColumnForDate = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime())) return null;

    let colOffset = 0;
    for (const m of monthHeaders) {
      if (date.getFullYear() === m.year && date.getMonth() === m.monthIndex) {
        const dayOfMonth = date.getDate();
        const weekInMonth = Math.min(m.weeksCount, Math.ceil(dayOfMonth / 7));
        return colOffset + (weekInMonth - 1);
      }
      colOffset += m.weeksCount;
    }
    return null;
  };

  const timelineRows: RoadmapTimelineRow[] = projects.map((proj) => {
    const startCol = getStartColumnForDate(proj.startDate);

    if (startCol === null) {
      return {
        project: proj,
        hasStage: false,
        paymentMarkers: [],
        startCol: 0,
        totalSpanCols: 0,
        noStartDate: !proj.startDate,
        outOfRange: !!proj.startDate,
      };
    }

    const totalWeeksWorked = Math.max(1, getTotalWeeks(proj.timeFrames));
    const spanCols = Math.min(totalWeeksWorked, Math.max(1, totalGridColumns - startCol));

    const paymentMarkers = (proj.paymentTerms || [])
      .map((pt, ptIdx) => ({ pt, ptIdx }))
      .filter(({ pt }) => !!pt.paymentWeek)
      .map(({ pt, ptIdx }) => ({
        col: startCol + (pt.paymentWeek! - 1),
        ptIdx,
        milestone: pt.milestone,
        amount: pt.amount,
        week: pt.paymentWeek!,
        status: (pt.paymentStatus || "wait") as PaymentStatus,
        invoiceDate: pt.invoiceDate,
      }))
      .filter((pm) => pm.col >= 0 && pm.col < totalGridColumns);

    return {
      project: proj,
      hasStage: true,
      paymentMarkers,
      startCol,
      totalSpanCols: spanCols,
      noStartDate: false,
      outOfRange: false,
    };
  });

  let colOffset = 0;
  const colToMonthIdx: number[] = [];
  monthHeaders.forEach((m, mIdx) => {
    for (let w = 0; w < m.weeksCount; w++) colToMonthIdx[colOffset + w] = mIdx;
    colOffset += m.weeksCount;
  });

  const monthlyTotals = new Array(monthHeaders.length).fill(0);
  for (const row of timelineRows) {
    for (const pm of row.paymentMarkers) {
      if (pm.status === "cancelled") continue;
      const mIdx = colToMonthIdx[pm.col];
      if (mIdx !== undefined) monthlyTotals[mIdx] += pm.amount;
    }
  }

  return { timelineRows, monthlyTotals, totalGridColumns };
}

export function buildRoadmapTimeline(projects: SavedRecord[]): {
  monthHeaders: RoadmapMonthConfig[];
  timelineRows: RoadmapTimelineRow[];
  monthlyTotals: number[];
  totalGridColumns: number;
} {
  const monthHeaders = buildMonthHeaders(projects);
  const { timelineRows, monthlyTotals, totalGridColumns } = buildTimelineForMonthHeaders(projects, monthHeaders);
  return { monthHeaders, timelineRows, monthlyTotals, totalGridColumns };
}
