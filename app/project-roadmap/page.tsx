"use client";

import { useEffect, useState, useMemo } from "react";
import { SavedRecord, PaymentStatus } from "@/lib/types";
import { getSupabaseClient, getSavedRecords } from "@/lib/supabase";
import { getTotalWeeks } from "@/lib/timeframe-utils";
import { useSettings } from "@/lib/settings-context";
import {
  CalendarRange,
  Building2,
  Calendar,
  Layers,
} from "lucide-react";

interface MonthConfig {
  name: string; // e.g. "Jul-26"
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
// week. A marker with no explicit status yet (no invoice date set) defaults
// to Wait, since gray is now reserved for the Stage All background.
const PAYMENT_MARKER_STYLES: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  wait: { bg: "bg-amber-300", text: "text-amber-950", label: "Wait" },
  invoice: { bg: "bg-sky-300", text: "text-sky-950", label: "Invoice" },
  paid: { bg: "bg-emerald-300", text: "text-emerald-950", label: "Paid" },
};

const formatCompactAmount = (amount: number): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const val = amount / 1_000_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(amount / 1000)}K`;
  }
  return String(Math.round(amount));
};

export default function ProjectRoadmapPage() {
  const { settings } = useSettings();
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  // Half year view (0: Jan-Jun, 6: Jul-Dec)
  const [startMonthIndex, setStartMonthIndex] = useState<number>(6); // Default to Jul (Jul-26 to Dec-26)
  const [monthsToShow, setMonthsToShow] = useState<number>(6);

  const [activePaymentTooltip, setActivePaymentTooltip] = useState<{
    projectName: string;
    milestone: string;
    amount: number;
    week: number;
    status: PaymentStatus;
    invoiceDate?: string;
  } | null>(null);

  // Load saved records from Supabase (shared across every device) with the
  // local history as a fallback/merge for anything not yet synced.
  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    getSavedRecords(supabase).then(setRecords);
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Only fully Approved proposals belong on the roadmap
  const allProjects: SavedRecord[] = useMemo(() => {
    return records.filter((r) => r.status === "approved");
  }, [records]);

  // Generate Month & Week header structure (e.g. Jul-26 -> W1, W2, W3, W4, W5)
  const monthHeaders: MonthConfig[] = useMemo(() => {
    const yrShort = String(selectedYear).slice(-2);
    const list: MonthConfig[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      const mIdx = (startMonthIndex + i) % 12;
      const mName = `${MONTH_NAMES[mIdx]}-${yrShort}`;
      // Give Jul and Oct 5 weeks, others 4 weeks for realistic month division
      const weeksCount = [0, 6, 9].includes(mIdx) ? 5 : 4;
      const weeks = Array.from({ length: weeksCount }, (_, w) => `W${w + 1}`);

      list.push({
        name: mName,
        monthIndex: mIdx,
        weeksCount,
        weeks,
      });
    }

    return list;
  }, [selectedYear, startMonthIndex, monthsToShow]);

  // Total columns in grid
  const totalGridColumns = useMemo(() => {
    return monthHeaders.reduce((acc, m) => acc + m.weeksCount, 0);
  }, [monthHeaders]);

  // Map a project's real Start Date (from the Operations tab) onto the
  // currently visible month/week grid. Returns null when there is no Start
  // Date set yet, or it falls outside the visible year/month range.
  const getStartColumnForDate = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime()) || date.getFullYear() !== selectedYear) return null;

    let colOffset = 0;
    for (const m of monthHeaders) {
      if (date.getMonth() === m.monthIndex) {
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
    return allProjects.map((proj) => {
      const startCol = getStartColumnForDate(proj.startDate);

      // No Start Date yet, or it's outside the visible range — don't guess a
      // position, just flag it so the UI can prompt for one instead.
      if (startCol === null) {
        return {
          project: proj,
          hasStage: false,
          paymentMarkers: [] as {
            col: number;
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
        .filter((pt) => !!pt.paymentWeek)
        .map((pt) => ({
          col: startCol + (pt.paymentWeek! - 1),
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
  }, [allProjects, totalGridColumns, monthHeaders, selectedYear]);

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
            </h1>
            <p className="text-[11px] text-slate-500">
              แผนงานโครงการดึงจากฐานข้อมูล Proposal แสดงเป็นหัวตารางรายเดือนและสัปดาห์
            </p>
          </div>
        </div>

        {/* View Range & Year Controls */}
        <div className="flex items-center gap-3">
          {/* Half Year Range Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setStartMonthIndex(0)}
              className={`px-3 py-1 rounded-md transition ${
                startMonthIndex === 0
                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Jan - Jun (Q1-Q2)
            </button>
            <button
              onClick={() => setStartMonthIndex(6)}
              className={`px-3 py-1 rounded-md transition ${
                startMonthIndex === 6
                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Jul - Dec (Q3-Q4)
            </button>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-medium shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>ปี:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
        {allProjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <CalendarRange className="w-10 h-10" />
            <p className="text-xs font-medium">ยังไม่มีโครงการที่มีสถานะ Approved</p>
            <p className="text-[11px] text-slate-400 max-w-sm text-center">
              โครงการจะปรากฏที่นี่เมื่อ Proposal ถูกเปลี่ยนสถานะเป็น &quot;Approved&quot; จากหน้า Proposal Preview
            </p>
          </div>
        ) : (
        <>
        {/* Minimal White Stacked Gantt Chart Container */}
        <div className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1050px]">
              {/* Header Row 1: Month Names (e.g. Jul-26, Aug-26, Sep-26...) */}
              <div className="flex border-b border-slate-300 bg-amber-50/70">
                {/* Left Top Box (Project Name Header) */}
                <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 flex items-center justify-between text-xs font-bold text-slate-800 bg-amber-100/60">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>Project Name</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">({allProjects.length})</span>
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

              {/* Header Row 2: Weeks per Month (W1, W2, W3, W4, W5...) */}
              <div className="flex border-b border-slate-300 bg-amber-50/30 text-[11px] font-mono text-slate-700">
                <div className="w-64 shrink-0 border-r border-slate-300 px-3.5 py-1.5 text-slate-500 text-[10px] font-sans bg-amber-50/50">
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
                {timelineRows.map((row, rowIdx) => {
                  const proj = row.project;

                  return (
                    <div
                      key={proj.id || rowIdx}
                      className="flex items-stretch hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Left Column: Project Name from Database */}
                      <div className="w-64 shrink-0 p-3.5 border-r border-slate-300 flex items-center gap-3 bg-white">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {proj.projectName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="text-xs font-bold text-slate-900 leading-tight truncate group-hover:text-indigo-600 transition-colors"
                            title={proj.projectName}
                          >
                            {proj.projectName}
                          </h3>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-mono mt-1">
                            <span className="text-emerald-700 font-bold">
                              ฿{Number(proj.totalFee).toLocaleString()}
                            </span>
                            <span>•</span>
                            <span>{proj.area ? proj.area.split("(")[0] : "Active"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Stage All background + Payment Week Markers */}
                      <div className="flex-1 relative p-3 flex items-center min-h-[76px] bg-white">
                        {!row.hasStage ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 font-medium">
                            {row.noStartDate
                              ? "ยังไม่ได้ระบุ Start Date — ไปตั้งค่าที่แท็บ \"รายละเอียดการดำเนินงาน\" ในหน้า Proposal Preview"
                              : `Start Date (${proj.startDate}) อยู่นอกช่วงเวลาที่แสดงอยู่ — ลองเปลี่ยนปีหรือช่วงเดือนด้านบน`}
                          </span>
                        ) : (
                        <>
                        {/* Background Dotted Vertical Gridlines for each Week */}
                        <div
                          className="absolute inset-0 grid divide-x divide-slate-200 pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                        />

                        <div className="relative w-full h-9">
                          {/* Stage All — flat gray background spanning every week worked */}
                          <div
                            className="absolute inset-0 grid w-full h-9"
                            style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                          >
                            <div
                              style={{ gridColumn: `${row.startCol + 1} / span ${row.totalSpanCols}` }}
                              className={`h-9 ${STAGE_ALL_STYLE.bg} ${STAGE_ALL_STYLE.text} rounded-md flex items-center px-3 mx-0.5 border border-black/5`}
                            >
                              <span className="truncate font-semibold text-[11px]">
                                Stage All • {row.totalSpanCols} Weeks
                              </span>
                            </div>
                          </div>

                          {/* Payment Week Markers — overlap on top, colored by status, showing amount instead of % */}
                          {row.paymentMarkers.length > 0 && (
                            <div
                              className="absolute inset-0 z-10 grid w-full h-9"
                              style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                            >
                              {row.paymentMarkers.map((pm, pmIdx) => {
                                const style = PAYMENT_MARKER_STYLES[pm.status];
                                return (
                                  <div
                                    key={pmIdx}
                                    style={{ gridColumn: `${pm.col + 1} / span 1` }}
                                    onMouseEnter={() =>
                                      setActivePaymentTooltip({
                                        projectName: proj.projectName,
                                        milestone: pm.milestone,
                                        amount: pm.amount,
                                        week: pm.week,
                                        status: pm.status,
                                        invoiceDate: pm.invoiceDate,
                                      })
                                    }
                                    onMouseLeave={() => setActivePaymentTooltip(null)}
                                    className={`h-9 ${style.bg} ${style.text} rounded-md shadow-2xs font-mono font-bold text-[10px] flex items-center justify-center cursor-pointer transition-all duration-150 hover:brightness-95 hover:scale-[1.03] hover:z-20 mx-0.5 border border-black/5`}
                                  >
                                    {formatCompactAmount(pm.amount)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
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

        {/* Hover Detail Tooltip Card — Payment Week Marker */}
        {activePaymentTooltip && (
          <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold text-[10px] border ${PAYMENT_MARKER_STYLES[activePaymentTooltip.status].bg} ${PAYMENT_MARKER_STYLES[activePaymentTooltip.status].text} border-black/5`}
              >
                <span>Week</span>
                <span>{activePaymentTooltip.week}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    {activePaymentTooltip.milestone}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-500">
                    ({activePaymentTooltip.projectName})
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  สถานะ:{" "}
                  <strong className="text-slate-800">
                    {PAYMENT_MARKER_STYLES[activePaymentTooltip.status].label}
                  </strong>
                  {activePaymentTooltip.invoiceDate ? ` • วันที่เรียกเก็บ: ${activePaymentTooltip.invoiceDate}` : ""}
                </p>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-mono font-extrabold text-sm rounded-lg shadow-2xs">
              ฿{Number(activePaymentTooltip.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

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
        </>
        )}
      </div>
    </div>
  );
}
