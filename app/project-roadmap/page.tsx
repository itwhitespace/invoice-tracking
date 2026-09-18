"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { SavedRecord, PaymentStatus, PaymentTermItem } from "@/lib/types";
import {
  getSupabaseClient,
  getSavedRecords,
  saveRecordLocally,
  updateRecordRemote,
  isRemoteId,
} from "@/lib/supabase";
import { getTotalWeeks, formatProjectDuration } from "@/lib/timeframe-utils";
import { DEPARTMENT_OPTIONS, formatDepartmentLabel, getDepartmentAbbreviation } from "@/lib/department-utils";
import { getCompanyLabel } from "@/lib/company-utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/payment-status-utils";
import { useSettings } from "@/lib/settings-context";
import { useSearchParams } from "next/navigation";
import { ProposalDetailModal } from "@/components/proposal-detail-modal";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import {
  CalendarRange,
  Building2,
  Calendar,
  Layers,
  Save,
  Loader2,
  CheckCircle2,
  Filter,
  StickyNote,
  HelpCircle,
  Download,
} from "lucide-react";

interface MonthConfig {
  name: string; // e.g. "Jul-26"
  year: number;
  monthIndex: number; // 0 to 11
  weeksCount: number; // 4 or 5
  weeks: string[]; // ["W1", "W2", "W3", "W4", "W5"]
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Stage All" background — one flat bar spanning every week actually worked.
const STAGE_ALL_STYLE = { bg: "bg-slate-200", text: "text-slate-500", label: "Stage All (ระยะเวลาทำงานทั้งหมด)" };

// Payment-week markers overlap on top of the Stage All bar at their planned
// week. A marker with no explicit status yet defaults to Wait.
const PAYMENT_MARKER_STYLES: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  wait: { bg: "bg-amber-300", text: "text-amber-950", label: PAYMENT_STATUS_LABELS.wait },
  invoice: { bg: "bg-sky-300", text: "text-sky-950", label: PAYMENT_STATUS_LABELS.invoice },
  paid: { bg: "bg-emerald-300", text: "text-emerald-950", label: PAYMENT_STATUS_LABELS.paid },
  hold: { bg: "bg-violet-300", text: "text-violet-950", label: PAYMENT_STATUS_LABELS.hold },
  cancelled: { bg: "bg-red-300", text: "text-red-950", label: PAYMENT_STATUS_LABELS.cancelled },
};

// Options for the status-picker modal (click a marker to open it).
const STATUS_PICKER_OPTIONS: { value: PaymentStatus; label: string }[] = (
  Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]
).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));

// A minimal pointer movement below this (px) is treated as a click (open the
// status picker) rather than the start of a drag-to-reschedule gesture.
const CLICK_MOVE_THRESHOLD = 5;

// Resolves the date that belongs to a payment term's current status — the
// same rule the detail modal's "วันที่ของสถานะ" column uses.
const getPaymentStatusInfo = (pt: PaymentTermItem): { status: PaymentStatus; date?: string } => {
  const status = pt.paymentStatus || "wait";
  const date = status === "paid" ? pt.paidDate : status === "invoice" ? pt.invoiceIssuedDate : pt.invoiceDate;
  return { status, date };
};

const formatShortDate = (dateStr: string): string => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

// Calendar date for "week N of the project" — used to suggest a new date
// when a payment marker is dragged onto a different week.
const computeDateForWeek = (startDateStr: string, week: number): string => {
  const start = new Date(`${startDateStr}T00:00:00`);
  if (isNaN(start.getTime())) return "";
  start.setDate(start.getDate() + (week - 1) * 7);
  return start.toISOString().slice(0, 10);
};

// A project's full visible span: from its Start Date through the later of
// (a) its total working duration or (b) its furthest-out planned payment
// week — whichever runs longer. Drives the auto-fit timeline range below.
const getProjectDateRange = (proj: SavedRecord): { start: Date; end: Date } | null => {
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
};

const TOOLTIP_WIDTH = 288; // px — matches the w-72 class on the floating tooltip card

// Each week column keeps at least this width regardless of how many months
// are in the auto-fit range — long ranges (multi-year) get wider instead of
// every column being squeezed thinner, and the container's overflow-x-auto
// picks up the horizontal scroll once that width exceeds the viewport.
// Tuned so ~6 months are comfortably visible before scrolling kicks in.
const PROJECT_NAME_COL_PX = 256; // matches the w-64 name column
const WEEK_COLUMN_MIN_PX = 46;
const CHART_MIN_PX = 850; // floor for short ranges

const formatCompactAmount = (amount: number): string => {
  return `${(amount / 1000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
};

export default function ProjectRoadmapPage() {
  return (
    <Suspense fallback={null}>
      <ProjectRoadmapContent />
    </Suspense>
  );
}

function ProjectRoadmapContent() {
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const companyFilter = searchParams.get("company") || "";
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  const [activePaymentTooltip, setActivePaymentTooltip] = useState<{
    projectName: string;
    milestone: string;
    amount: number;
    week: number;
    status: PaymentStatus;
    invoiceDate?: string;
    anchorRect: { left: number; width: number; bottom: number };
  } | null>(null);

  // Drag-to-reschedule a payment marker to a different week. Implemented
  // with raw Pointer Events (not native HTML5 drag-and-drop) — the native
  // API turned out unreliable here: it silently cancels the drag in some
  // browsers/setups with no clear signal why, whereas pointer events give
  // full control and work identically everywhere.
  const [dragState, setDragState] = useState<{
    recordId: string;
    ptIdx: number;
    originalWeek: number;
    startCol: number;
    rectLeft: number;
    colWidth: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    recordId: string;
    ptIdx: number;
    milestone: string;
    projectName: string;
    newWeek: number;
    oldDate?: string;
    newDate: string;
    statusField: "invoiceDate" | "invoiceIssuedDate" | "paidDate";
  } | null>(null);
  const [showDropSuccess, setShowDropSuccess] = useState<{ oldDate?: string; newDate: string } | null>(null);
  const [isSavingDrop, setIsSavingDrop] = useState(false);

  // Free-text Roadmap note — opened by clicking a project's department badge
  const [noteEditor, setNoteEditor] = useState<{ recordId: string; projectName: string; value: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Payment-term status picker — opened by clicking (not dragging) a marker
  const [statusEditor, setStatusEditor] = useState<{
    recordId: string;
    ptIdx: number;
    milestone: string;
    projectName: string;
    currentStatus: PaymentStatus;
  } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PaymentStatus>("wait");
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Full Proposal detail — opened by clicking a project's name
  const [detailRecord, setDetailRecord] = useState<SavedRecord | null>(null);
  const [previewPdfRecord, setPreviewPdfRecord] = useState<SavedRecord | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (statusEditor) setPendingStatus(statusEditor.currentStatus);
  }, [statusEditor]);

  // Load saved records from Supabase (shared across every device) with the
  // local history as a fallback/merge for anything not yet synced.
  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    getSavedRecords(supabase).then(setRecords);
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Only fully Approved proposals belong on the roadmap, narrowed further by
  // the company selected from the sidebar submenu ("Project by"), if any.
  const allProjects: SavedRecord[] = useMemo(() => {
    return records.filter(
      (r) => r.status === "approved" && (!companyFilter || r.companyName === companyFilter)
    );
  }, [records, companyFilter]);

  // Department filter narrows the visible set; the timeline, totals and
  // "no projects" messaging all key off this filtered list. The filter's
  // own option list stays derived from allProjects (unfiltered) so picking
  // a department never makes other departments disappear from the dropdown.
  const filteredProjects: SavedRecord[] = useMemo(() => {
    if (!departmentFilter) return allProjects;
    return allProjects.filter((p) => p.department === departmentFilter);
  }, [allProjects, departmentFilter]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const proj of allProjects) {
      if (proj.department) set.add(proj.department);
    }
    return DEPARTMENT_OPTIONS.filter((d) => set.has(d));
  }, [allProjects]);

  // The timeline auto-fits to the actual data: span from the earliest
  // visible project's Start Date through the latest project's end (working
  // duration or furthest payment week, whichever runs longer) — no manual
  // year/quarter filter needed, and nothing ever gets cut off at a boundary.
  const dateRange = useMemo(() => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const proj of filteredProjects) {
      const range = getProjectDateRange(proj);
      if (!range) continue;
      if (!minDate || range.start < minDate) minDate = range.start;
      if (!maxDate || range.end > maxDate) maxDate = range.end;
    }
    if (!minDate || !maxDate) return null;
    return { minDate, maxDate };
  }, [filteredProjects]);

  // Generate Month & Week header structure (e.g. Jul-26 -> W1, W2, W3, W4, W5)
  // continuously from dateRange.minDate to dateRange.maxDate, rolling over
  // calendar years as needed.
  const monthHeaders: MonthConfig[] = useMemo(() => {
    if (!dateRange) return [];

    const buildList = (endYear: number, endMonthIndex: number): MonthConfig[] => {
      const list: MonthConfig[] = [];
      let y = dateRange.minDate.getFullYear();
      let m = dateRange.minDate.getMonth();
      let guard = 0;
      while ((y < endYear || (y === endYear && m <= endMonthIndex)) && guard < 240) {
        const yrShort = String(y).slice(-2);
        // Give Jan, Jul and Oct 5 weeks, others 4 weeks for realistic month division
        const weeksCount = [0, 6, 9].includes(m) ? 5 : 4;
        const weeks = Array.from({ length: weeksCount }, (_, w) => `W${w + 1}`);
        list.push({ name: `${MONTH_NAMES[m]}-${yrShort}`, year: y, monthIndex: m, weeksCount, weeks });
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
        guard++;
      }
      return list;
    };

    let endYear = dateRange.maxDate.getFullYear();
    let endMonthIndex = dateRange.maxDate.getMonth();
    let list = buildList(endYear, endMonthIndex);

    // The 4-or-5-weeks-per-calendar-month scheme above is a stylized
    // approximation, not a literal week count — over a long span it can add
    // up to fewer synthetic columns than a project's real duration needs
    // (e.g. its own Start Date -> furthest payment week), which would
    // otherwise silently clip that project's Stage-All bar and drop its
    // payment markers right at the grid's edge. Keep appending trailing
    // months until every visible project's own required span actually fits.
    const colOffsetForDate = (hdrs: MonthConfig[], dateStr?: string): number | null => {
      if (!dateStr) return null;
      const date = new Date(`${dateStr}T00:00:00`);
      if (isNaN(date.getTime())) return null;
      let colOffset = 0;
      for (const mh of hdrs) {
        if (date.getFullYear() === mh.year && date.getMonth() === mh.monthIndex) {
          const dayOfMonth = date.getDate();
          const weekInMonth = Math.min(mh.weeksCount, Math.ceil(dayOfMonth / 7));
          return colOffset + (weekInMonth - 1);
        }
        colOffset += mh.weeksCount;
      }
      return null;
    };

    let guard = 0;
    while (guard < 240) {
      const totalCols = list.reduce((acc, mh) => acc + mh.weeksCount, 0);
      const needsMore = filteredProjects.some((proj) => {
        const startCol = colOffsetForDate(list, proj.startDate);
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
      list = buildList(endYear, endMonthIndex);
      guard++;
    }

    return list;
  }, [dateRange, filteredProjects]);

  // Total columns in grid
  const totalGridColumns = useMemo(() => {
    return monthHeaders.reduce((acc, m) => acc + m.weeksCount, 0);
  }, [monthHeaders]);

  // While a payment marker is being dragged, track the pointer across the
  // whole window (not just the element) so the drag keeps working even once
  // the cursor leaves the small marker/grid area.
  useEffect(() => {
    if (!dragState) return;

    const colAt = (clientX: number) =>
      Math.max(0, Math.min(totalGridColumns - 1, Math.floor((clientX - dragState.rectLeft) / dragState.colWidth)));

    const handlePointerMove = (e: PointerEvent) => {
      setDragOverCol(colAt(e.clientX));
    };
    const handlePointerUp = (e: PointerEvent) => {
      const col = colAt(e.clientX);
      const { recordId, ptIdx, originalWeek, startCol, startX, startY } = dragState;
      setDragState(null);
      setDragOverCol(null);

      const proj = filteredProjects.find((p) => p.id === recordId);
      if (!proj) return;
      const pt = proj.paymentTerms[ptIdx];
      if (!pt) return;

      // Barely any movement = a click, not a drag — open the status picker.
      const movedDistance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (movedDistance < CLICK_MOVE_THRESHOLD) {
        setStatusEditor({
          recordId: proj.id,
          ptIdx,
          milestone: pt.milestone,
          projectName: proj.projectName,
          currentStatus: pt.paymentStatus || "wait",
        });
        return;
      }

      const newWeek = col - startCol + 1;
      if (newWeek < 1 || newWeek === originalWeek) return;

      const { status, date: oldDate } = getPaymentStatusInfo(pt);
      const statusField: "invoiceDate" | "invoiceIssuedDate" | "paidDate" =
        status === "paid" ? "paidDate" : status === "invoice" ? "invoiceIssuedDate" : "invoiceDate";
      const newDate = proj.startDate ? computeDateForWeek(proj.startDate, newWeek) : "";

      setPendingDrop({
        recordId: proj.id,
        ptIdx,
        milestone: pt.milestone,
        projectName: proj.projectName,
        newWeek,
        oldDate,
        newDate,
        statusField,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, totalGridColumns, filteredProjects]);

  // Map a project's real Start Date (from the Operations tab) onto the
  // auto-fit month/week grid above. The grid is sized to include every
  // approved project's full span, so this should always find a match — null
  // only means no Start Date is set, or a date-math edge case.
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

  // Build Project Timeline Rows
  const timelineRows = useMemo(() => {
    return filteredProjects.map((proj) => {
      const startCol = getStartColumnForDate(proj.startDate);

      // No Start Date yet, or it's outside the visible range — don't guess a
      // position, just flag it so the UI can prompt for one instead.
      if (startCol === null) {
        return {
          project: proj,
          hasStage: false,
          paymentMarkers: [] as {
            col: number;
            ptIdx: number;
            milestone: string;
            amount: number;
            week: number;
            status: PaymentStatus;
            invoiceDate?: string;
          }[],
          startCol: 0,
          totalSpanCols: 0,
          noStartDate: !proj.startDate,
          outOfRange: !!proj.startDate,
        };
      }

      // Stage All — one flat bar spanning every week actually worked,
      // clamped so it never overruns the visible grid.
      const totalWeeksWorked = Math.max(1, getTotalWeeks(proj.timeFrames));
      const spanCols = Math.min(totalWeeksWorked, Math.max(1, totalGridColumns - startCol));

      // Payment-week markers overlap on top of the Stage All bar, positioned
      // by each milestone's own planned week.
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
  }, [filteredProjects, totalGridColumns, monthHeaders]);

  // Sum of every project's payment markers landing in each month column —
  // shown as a totals row under the month headers.
  const monthlyTotals = useMemo(() => {
    let colOffset = 0;
    const colToMonthIdx: number[] = [];
    monthHeaders.forEach((m, mIdx) => {
      for (let w = 0; w < m.weeksCount; w++) colToMonthIdx[colOffset + w] = mIdx;
      colOffset += m.weeksCount;
    });

    const totals = new Array(monthHeaders.length).fill(0);
    for (const row of timelineRows) {
      for (const pm of row.paymentMarkers) {
        if (pm.status === "cancelled") continue; // Only cancelled installments are excluded — Hold still counts normally
        const mIdx = colToMonthIdx[pm.col];
        if (mIdx !== undefined) totals[mIdx] += pm.amount;
      }
    }
    return totals;
  }, [timelineRows, monthHeaders]);

  // Rows actually rendered in the Gantt — hidden projects are left out of
  // the visible table, but monthlyTotals above (computed from the full
  // timelineRows) still counts their amounts.
  const visibleTimelineRows = useMemo(
    () => timelineRows.filter((row) => !row.project.roadmapHidden),
    [timelineRows]
  );

  // Starts a drag: measure the row's payment-marker grid once so pointermove
  // (handled by the window-level effect above) can cheaply convert cursor X
  // into a column index for the rest of the gesture.
  const handleMarkerPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    recordId: string,
    ptIdx: number,
    originalWeek: number,
    rowStartCol: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const gridEl = e.currentTarget.parentElement;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const colWidth = rect.width / totalGridColumns;
    setDragState({
      recordId,
      ptIdx,
      originalWeek,
      startCol: rowStartCol,
      rectLeft: rect.left,
      colWidth,
      startX: e.clientX,
      startY: e.clientY,
    });
    setDragOverCol(Math.max(0, Math.min(totalGridColumns - 1, Math.floor((e.clientX - rect.left) / colWidth))));
  };

  const handleConfirmDrop = async () => {
    if (!pendingDrop) return;
    const record = records.find((r) => r.id === pendingDrop.recordId);
    if (!record) {
      setPendingDrop(null);
      return;
    }

    setIsSavingDrop(true);
    try {
      const updatedTerms = [...record.paymentTerms];
      const current: PaymentTermItem = {
        ...updatedTerms[pendingDrop.ptIdx],
        paymentWeek: pendingDrop.newWeek,
        [pendingDrop.statusField]: pendingDrop.newDate || undefined,
      };
      updatedTerms[pendingDrop.ptIdx] = current;
      const updated: SavedRecord = { ...record, paymentTerms: updatedTerms };

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      saveRecordLocally(updated);

      const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (supabase && isRemoteId(updated.id)) {
        const { error } = await updateRecordRemote(supabase, updated);
        if (error) {
          window.alert("อัปเดตขึ้น Supabase ไม่สำเร็จ: " + error);
        }
      }

      setShowDropSuccess({ oldDate: pendingDrop.oldDate, newDate: pendingDrop.newDate });
      setPendingDrop(null);
    } finally {
      setIsSavingDrop(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteEditor) return;
    const record = records.find((r) => r.id === noteEditor.recordId);
    if (!record) {
      setNoteEditor(null);
      return;
    }

    setIsSavingNote(true);
    try {
      const updated: SavedRecord = { ...record, roadmapNote: noteEditor.value };

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      saveRecordLocally(updated);

      const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (supabase && isRemoteId(updated.id)) {
        const { error } = await updateRecordRemote(supabase, updated);
        if (error) {
          window.alert("อัปเดตขึ้น Supabase ไม่สำเร็จ: " + error);
        }
      }

      setNoteEditor(null);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Setting a milestone to "cancelled" also cancels every later installment
  // (by position) automatically — reverting back is manual, one row at a
  // time, since there's no reliable "previous status" to restore to.
  const handleSaveStatus = async () => {
    if (!statusEditor) return;
    const record = records.find((r) => r.id === statusEditor.recordId);
    if (!record) {
      setStatusEditor(null);
      return;
    }

    setIsSavingStatus(true);
    try {
      const updatedTerms = record.paymentTerms.map((pt, idx) => {
        if (idx === statusEditor.ptIdx) {
          return { ...pt, paymentStatus: pendingStatus };
        }
        if (pendingStatus === "cancelled" && idx > statusEditor.ptIdx) {
          return { ...pt, paymentStatus: "cancelled" as PaymentStatus };
        }
        return pt;
      });
      const updated: SavedRecord = { ...record, paymentTerms: updatedTerms };

      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      saveRecordLocally(updated);

      const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (supabase && isRemoteId(updated.id)) {
        const { error } = await updateRecordRemote(supabase, updated);
        if (error) {
          window.alert("อัปเดตขึ้น Supabase ไม่สำเร็จ: " + error);
        }
      }

      setStatusEditor(null);
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Used by the full Proposal detail modal (opened by clicking a project's
  // name) for any edit made inside it — % splits, Operations tab, Approve, etc.
  const handleUpdateRecord = async (updated: SavedRecord) => {
    setDetailRecord(updated);
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    saveRecordLocally(updated);

    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    if (supabase && isRemoteId(updated.id)) {
      const { error } = await updateRecordRemote(supabase, updated);
      if (error) {
        window.alert("บันทึกใน Local History แล้ว แต่อัปเดตขึ้น Supabase ไม่สำเร็จ: " + error);
      }
    }
  };

  // Always exports every approved project across both companies — one sheet
  // per Department (tab-colored by which company that department belongs
  // to), plus a combined Summary sheet up front — regardless of whatever
  // company/department filter is currently applied on screen.
  // exceljs is dynamically imported so its ~1MB doesn't bloat the page's own bundle.
  const handleExportExcel = async () => {
    const allApproved = records.filter((r) => r.status === "approved");
    if (isExporting || allApproved.length === 0) return;
    setIsExporting(true);
    try {
      const { exportRoadmapToExcel } = await import("@/lib/roadmap-export");
      await exportRoadmapToExcel({ projects: allApproved });
    } catch (err: any) {
      window.alert("Export Excel ไม่สำเร็จ: " + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 text-slate-800 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <CalendarRange className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Project Roadmap
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-full">
                Monthly & Weekly Minimalist Gantt
              </span>
              {companyFilter && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                  {getCompanyLabel(companyFilter)}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-500">
              แผนงานโครงการดึงจากฐานข้อมูล Proposal แสดงเป็นหัวตารางรายเดือนและสัปดาห์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
        {/* Department Filter */}
        {allProjects.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">ทุกแผนก (All Departments)</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {formatDepartmentLabel(dept)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Auto-Fit Range Display — computed from the data, not a filter */}
        {monthHeaders.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">ช่วงเวลาที่แสดง:</span>
            <span className="font-bold text-slate-900">
              {monthHeaders[0].name} – {monthHeaders[monthHeaders.length - 1].name}
            </span>
          </div>
        )}

        {/* Export to Excel — always exports every approved project across its
            full lifetime, regardless of the filters above or any fiscal
            year; no Annual Billing here (see the Dashboard's own export for
            a single fiscal year's budget report). */}
        {records.some((r) => r.status === "approved") && (
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            title="ครอบคลุมทุกโครงการ Approved ทั้งหมด ทุกช่วงเวลา (ไม่ใช่รายงานตามรอบงบประมาณ)"
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 shadow-2xs transition-colors"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isExporting ? "กำลังสร้างไฟล์..." : "Export ภาพรวมทั้งหมด (Excel)"}
          </button>
        )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
        {allProjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <CalendarRange className="w-10 h-10" />
            <p className="text-xs font-medium">
              {companyFilter
                ? `ยังไม่มีโครงการของ "${getCompanyLabel(companyFilter)}" ที่มีสถานะ Approved`
                : "ยังไม่มีโครงการที่มีสถานะ Approved"}
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm text-center">
              โครงการจะปรากฏที่นี่เมื่อ Proposal ถูกเปลี่ยนสถานะเป็น &quot;Approved&quot; จากหน้า Proposal Preview
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <Filter className="w-10 h-10" />
            <p className="text-xs font-medium">ไม่มีโครงการในแผนก &quot;{formatDepartmentLabel(departmentFilter)}&quot;</p>
            <button
              onClick={() => setDepartmentFilter("")}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold underline"
            >
              ล้างตัวกรองเพื่อดูทุกแผนก
            </button>
          </div>
        ) : (
        <>
        {/* Color Legend */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>คำอธิบายสี:</span>
            </div>

            <div className="flex items-center flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                <span className={`w-3.5 h-3.5 rounded-sm ${STAGE_ALL_STYLE.bg} border border-black/5 shadow-2xs`} />
                <span>{STAGE_ALL_STYLE.label}</span>
              </div>
              {Object.entries(PAYMENT_MARKER_STYLES).map(([key, style]) => (
                <div key={key} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <span className={`w-3.5 h-3.5 rounded-sm ${style.bg} border border-black/5 shadow-2xs`} />
                  <span>{style.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Minimal White Stacked Gantt Chart Container */}
        <div className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: PROJECT_NAME_COL_PX + Math.max(CHART_MIN_PX, totalGridColumns * WEEK_COLUMN_MIN_PX) }}>
              {/* Header Row 1: Month Names (e.g. Jul-26, Aug-26, Sep-26...) */}
              <div className="flex border-b border-slate-300 bg-amber-50/70">
                {/* Left Top Box (Project Name Header) */}
                <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 flex items-center justify-between text-xs font-bold text-slate-800 bg-amber-100 sticky left-0 z-20">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>Project Name</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">({visibleTimelineRows.length})</span>
                </div>

                {/* Right Month Columns */}
                <div className="flex-1 flex divide-x divide-slate-300 text-center text-xs font-bold text-slate-900">
                  {monthHeaders.map((m, idx) => (
                    <div
                      key={idx}
                      style={{ flex: m.weeksCount }}
                      className="py-2.5 px-2 bg-amber-50/80 font-bold border-b border-slate-300 tracking-wide text-slate-900"
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Header Row 2: Monthly Totals — sum of payment markers landing in each month */}
              <div className="flex border-b border-slate-300 bg-emerald-200/70">
                <div className="w-64 shrink-0 border-r border-slate-300 px-3.5 py-1.5 text-emerald-800 text-[10px] font-sans font-semibold bg-emerald-200 sticky left-0 z-20">
                  ยอดรวมต่อเดือน
                </div>
                <div className="flex-1 flex divide-x divide-emerald-300/70 text-center">
                  {monthHeaders.map((m, idx) => (
                    <div
                      key={idx}
                      style={{ flex: m.weeksCount }}
                      className="py-1.5 px-2 font-mono font-bold text-[11px] text-emerald-900"
                    >
                      {monthlyTotals[idx] > 0 ? `฿${monthlyTotals[idx].toLocaleString("en-US")}` : "-"}
                    </div>
                  ))}
                </div>
              </div>

              {/* Header Row 3: Weeks per Month (W1, W2, W3, W4, W5...) */}
              <div className="flex border-b border-slate-300 bg-amber-50/30 text-[11px] font-mono text-slate-700">
                <div className="w-64 shrink-0 border-r border-slate-300 px-3.5 py-1.5 text-slate-500 text-[10px] font-sans bg-amber-50 sticky left-0 z-20">
                  ข้อมูลโครงการจาก Proposal
                </div>
                <div className="flex-1 flex divide-x divide-slate-300 text-center py-1.5">
                  {monthHeaders.flatMap((m, mIdx) =>
                    m.weeks.map((w, wIdx) => (
                      <div
                        key={`${mIdx}_${wIdx}`}
                        className="flex-1 text-slate-800 font-semibold text-[11px]"
                      >
                        {w}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Gantt Project Rows on Clean White Background */}
              <div className="divide-y divide-slate-200 relative bg-white">
                {visibleTimelineRows.map((row, rowIdx) => {
                  const proj = row.project;

                  return (
                    <div
                      key={proj.id || rowIdx}
                      className="flex items-stretch hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Left Column: Project Name from Database */}
                      <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 flex items-start gap-3 bg-white sticky left-0 z-40 group-hover:bg-slate-50">
                        <button
                          type="button"
                          onClick={() =>
                            setNoteEditor({
                              recordId: proj.id,
                              projectName: proj.projectName,
                              value: proj.roadmapNote || "",
                            })
                          }
                          className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition"
                          title={`${proj.department ? formatDepartmentLabel(proj.department) : "ยังไม่ได้ระบุแผนก"} — คลิกเพื่อเพิ่ม/แก้ไขโน้ต`}
                        >
                          {getDepartmentAbbreviation(proj.department)}
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetailRecord(proj)}
                            className="text-xs font-bold text-slate-900 leading-tight truncate hover:text-indigo-600 hover:underline transition-colors text-left block w-full"
                            title={`${proj.projectName} — คลิกเพื่อดูรายละเอียด Proposal`}
                          >
                            {proj.projectName}
                          </button>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-mono mt-1">
                            <span className="text-emerald-700 font-bold">
                              ฿{Number(proj.totalFee).toLocaleString()}
                            </span>
                            <span>•</span>
                            <span>{formatProjectDuration(proj)}</span>
                          </div>

                          {/* Roadmap note — click here (or the department badge) to add/edit */}
                          <button
                            type="button"
                            onClick={() =>
                              setNoteEditor({
                                recordId: proj.id,
                                projectName: proj.projectName,
                                value: proj.roadmapNote || "",
                              })
                            }
                            className="mt-1.5 flex items-start gap-1 text-left w-full group/note"
                            title="คลิกเพื่อเพิ่ม/แก้ไขโน้ต"
                          >
                            <StickyNote className="w-2.5 h-2.5 text-slate-400 group-hover/note:text-indigo-500 shrink-0 mt-0.5 transition-colors" />
                            <p className="text-[10px] text-slate-500 group-hover/note:text-indigo-600 leading-snug line-clamp-2 transition-colors">
                              {proj.roadmapNote || (
                                <span className="text-slate-300 italic group-hover/note:text-indigo-300">
                                  คลิกเพื่อเพิ่มโน้ต
                                </span>
                              )}
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Right Column: Stage All background + Payment Week Markers */}
                      <div className="flex-1 relative p-3 flex items-center min-h-[76px] bg-white">
                        {!row.hasStage ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 font-medium">
                            {row.noStartDate
                              ? "ยังไม่ได้ระบุ Start Date — ไปตั้งค่าที่แท็บ \"รายละเอียดการดำเนินงาน\" ในหน้า Proposal Preview"
                              : `เกิดข้อผิดพลาดในการคำนวณตำแหน่งของ Start Date (${proj.startDate})`}
                          </span>
                        ) : (
                        <>
                        {/* Background Dotted Vertical Gridlines for each Week */}
                        <div
                          className="absolute inset-0 grid divide-x divide-slate-200 pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                        />

                        <div className="relative w-full">
                          {/* Stage label caption — kept above the bar (not inside it) so an
                              early payment marker never covers the "Stage All" text */}
                          <div
                            className="grid w-full h-4 mb-1"
                            style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                          >
                            <div
                              style={{ gridColumn: `${row.startCol + 1} / span ${row.totalSpanCols}` }}
                              className="truncate font-semibold text-[10px] text-slate-500 px-1"
                            >
                              Stage All • {row.totalSpanCols} Weeks
                            </div>
                          </div>

                          <div className="relative w-full h-9">
                          {/* Stage All — flat gray background spanning every week worked */}
                          <div
                            className="absolute inset-0 grid w-full h-9"
                            style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                          >
                            <div
                              style={{ gridColumn: `${row.startCol + 1} / span ${row.totalSpanCols}` }}
                              className={`h-9 ${STAGE_ALL_STYLE.bg} ${STAGE_ALL_STYLE.text} rounded-md mx-0.5 border border-black/5`}
                            />
                          </div>

                          {/* Payment Week Markers — overlap on top, colored by status, showing amount instead of % */}
                          {row.paymentMarkers.length > 0 && (
                            <div
                              className="absolute inset-0 z-10 grid w-full h-9"
                              style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                            >
                              {row.paymentMarkers.map((pm, pmIdx) => {
                                const style = PAYMENT_MARKER_STYLES[pm.status];
                                const isBeingDragged =
                                  dragState?.recordId === proj.id && dragState.ptIdx === pm.ptIdx;
                                return (
                                  <div
                                    key={pmIdx}
                                    onPointerDown={(e) =>
                                      handleMarkerPointerDown(e, proj.id, pm.ptIdx, pm.week, row.startCol)
                                    }
                                    style={{ gridColumn: `${pm.col + 1} / span 1`, touchAction: "none" }}
                                    onMouseEnter={(e) => {
                                      if (dragState) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActivePaymentTooltip({
                                        projectName: proj.projectName,
                                        milestone: pm.milestone,
                                        amount: pm.amount,
                                        week: pm.week,
                                        status: pm.status,
                                        invoiceDate: pm.invoiceDate,
                                        anchorRect: { left: rect.left, width: rect.width, bottom: rect.bottom },
                                      });
                                    }}
                                    onMouseLeave={() => setActivePaymentTooltip(null)}
                                    title="คลิกเพื่อเปลี่ยนสถานะ • ลากเพื่อย้ายไปสัปดาห์อื่น"
                                    className={`h-9 ${style.bg} ${style.text} rounded-md shadow-2xs font-mono flex flex-col items-center justify-center leading-none gap-0.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:brightness-95 hover:scale-[1.03] hover:z-20 mx-0.5 border border-black/5 select-none ${
                                      isBeingDragged ? "opacity-40" : ""
                                    }`}
                                  >
                                    <span className="text-[8px] font-semibold opacity-80">
                                      {pm.ptIdx + 1}/{proj.paymentTerms.length}
                                    </span>
                                    <span className="text-[10px] font-bold">{formatCompactAmount(pm.amount)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Highlights the column the marker would drop into (this project's row only) */}
                          {dragState && dragState.recordId === proj.id && dragOverCol !== null && (
                            <div
                              className="absolute inset-0 z-30 grid w-full h-9 pointer-events-none"
                              style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                            >
                              <div
                                style={{ gridColumn: `${dragOverCol + 1} / span 1` }}
                                className="h-9 rounded-md bg-indigo-500/15 outline outline-2 outline-indigo-400"
                              />
                            </div>
                          )}
                          </div>
                        </div>
                        </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        </>
        )}
      </div>

      {/* Hover Detail Tooltip Card — Payment Week Marker. Floats directly
          below the hovered marker (not pinned to the bottom of the page),
          clamped horizontally so it never runs off the left/right edge. */}
      {activePaymentTooltip && (
        <div
          className="fixed z-40 w-72 p-3 bg-white border border-slate-300 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100 pointer-events-none"
          style={{
            top: activePaymentTooltip.anchorRect.bottom + 8,
            left: Math.min(
              Math.max(8, activePaymentTooltip.anchorRect.left + activePaymentTooltip.anchorRect.width / 2 - TOOLTIP_WIDTH / 2),
              (typeof window !== "undefined" ? window.innerWidth : TOOLTIP_WIDTH) - TOOLTIP_WIDTH - 8
            ),
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 leading-snug break-words">
                {activePaymentTooltip.milestone}
              </h4>
              <p className="text-[10.5px] text-slate-500 truncate mt-0.5">{activePaymentTooltip.projectName}</p>
            </div>
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${PAYMENT_MARKER_STYLES[activePaymentTooltip.status].bg} ${PAYMENT_MARKER_STYLES[activePaymentTooltip.status].text}`}
            >
              {PAYMENT_MARKER_STYLES[activePaymentTooltip.status].label}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              Week {activePaymentTooltip.week}
              {activePaymentTooltip.invoiceDate ? ` • ${activePaymentTooltip.invoiceDate}` : ""}
            </span>
            <span className="font-mono font-extrabold text-emerald-700">
              ฿{Number(activePaymentTooltip.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Drag-to-Reschedule: confirm the new week + let Admin adjust the date */}
      {pendingDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ย้ายกำหนดการเก็บเงิน</h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingDrop.milestone} ({pendingDrop.projectName}) →{" "}
                <strong className="text-slate-800">Week {pendingDrop.newWeek}</strong>
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-slate-500">วันที่เดิม</span>
                <span className="font-mono font-semibold text-slate-700">
                  {pendingDrop.oldDate ? formatShortDate(pendingDrop.oldDate) : "-"}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  วันที่ใหม่ของสัปดาห์นี้
                </label>
                <input
                  type="date"
                  value={pendingDrop.newDate}
                  onChange={(e) => setPendingDrop({ ...pendingDrop, newDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setPendingDrop(null)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDrop}
                disabled={isSavingDrop}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSavingDrop ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag-to-Reschedule: success */}
      {showDropSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">อัปเดตวันที่เรียบร้อย</h3>
              <p className="text-xs text-slate-500 mt-1">
                อัปเดตวันที่จาก{" "}
                <strong className="text-slate-700">
                  {showDropSuccess.oldDate ? formatShortDate(showDropSuccess.oldDate) : "-"}
                </strong>{" "}
                →{" "}
                <strong className="text-slate-700">{formatShortDate(showDropSuccess.newDate)}</strong>{" "}
                เรียบร้อย
              </p>
            </div>
            <button
              onClick={() => setShowDropSuccess(null)}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Roadmap Note Editor */}
      {noteEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                <StickyNote className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">โน้ตของโครงการ</h3>
                <p className="text-[11px] text-slate-500 truncate">{noteEditor.projectName}</p>
              </div>
            </div>
            <textarea
              value={noteEditor.value}
              onChange={(e) => setNoteEditor({ ...noteEditor, value: e.target.value })}
              rows={4}
              placeholder="พิมพ์โน้ตสำหรับโครงการนี้..."
              autoFocus
              className="w-full px-3 py-2 text-xs text-slate-800 bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setNoteEditor(null)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSavingNote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Status Picker — click a marker (not drag) to open */}
      {statusEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">เปลี่ยนสถานะการชำระเงิน</h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {statusEditor.milestone} ({statusEditor.projectName})
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {STATUS_PICKER_OPTIONS.map((opt) => {
                const style = PAYMENT_MARKER_STYLES[opt.value];
                const isSelected = pendingStatus === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition ${
                      isSelected ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-400" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-status"
                      checked={isSelected}
                      onChange={() => setPendingStatus(opt.value)}
                      className="shrink-0"
                    />
                    <span className={`w-3 h-3 rounded-full shrink-0 ${style.bg} border border-black/10`} />
                    <span className="text-xs font-semibold text-slate-800">{opt.label}</span>
                  </label>
                );
              })}
            </div>

            {pendingStatus === "cancelled" && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                หมายเหตุ: งวดถัดไปทั้งหมดหลังจากงวดนี้จะถูกเปลี่ยนเป็น &quot;ยกเลิกงาน&quot; ไปด้วยโดยอัตโนมัติ
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setStatusEditor(null)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={isSavingStatus}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSavingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Proposal Detail — opened by clicking a project's name */}
      <ProposalDetailModal
        isOpen={!!detailRecord}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onOpenPdf={(rec) => {
          setDetailRecord(null);
          setPreviewPdfRecord(rec);
        }}
        onUpdate={handleUpdateRecord}
      />

      {/* PDF Preview */}
      <PdfPreviewModal
        isOpen={!!previewPdfRecord}
        pdfUrl={previewPdfRecord?.pdfUrl || null}
        title={previewPdfRecord?.projectName}
        onClose={() => setPreviewPdfRecord(null)}
      />
    </div>
  );
}
