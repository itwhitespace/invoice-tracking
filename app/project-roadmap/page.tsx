"use client";

import { useEffect, useState, useMemo } from "react";
import { SavedRecord } from "@/lib/types";
import { getSupabaseClient, getSavedRecords } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import {
  CalendarRange,
  Building2,
  Calendar,
  Layers,
} from "lucide-react";

// Minimal pastel palette
const MINIMAL_PASTEL_COLORS = [
  {
    bg: "bg-[#7DD3FC]", // Pastel Sky Blue
    text: "text-slate-900",
    name: "Phase 1: Concept / Deposit",
  },
  {
    bg: "bg-[#FEF08A]", // Soft Butter Cream
    text: "text-slate-900",
    name: "Phase 2: Schematic / 3D",
  },
  {
    bg: "bg-[#C4B5FD]", // Soft Lavender
    text: "text-slate-900",
    name: "Phase 3: Design Development",
  },
  {
    bg: "bg-[#FDA4AF]", // Soft Coral / Pink
    text: "text-slate-900",
    name: "Phase 4: Working Drawings",
  },
  {
    bg: "bg-[#6EE7B7]", // Mint Green
    text: "text-slate-900",
    name: "Phase 5: Site Supervision",
  },
  {
    bg: "bg-[#FDBA74]", // Soft Peach
    text: "text-slate-900",
    name: "Phase 6: Final Handover",
  },
];

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

export default function ProjectRoadmapPage() {
  const { settings } = useSettings();
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  // Half year view (0: Jan-Jun, 6: Jul-Dec)
  const [startMonthIndex, setStartMonthIndex] = useState<number>(6); // Default to Jul (Jul-26 to Dec-26)
  const [monthsToShow, setMonthsToShow] = useState<number>(6);

  const [activeTooltip, setActiveTooltip] = useState<{
    projectName: string;
    phaseName: string;
    duration: string;
    paymentMilestone: string;
    paymentPercentage: number;
    paymentAmount: number;
    monthName: string;
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

  // Helper to parse weeks
  const parseWeeks = (str: string): number => {
    if (!str) return 3;
    const match = str.match(/(\d+)\s*(week|month|day|สัปดาห์|เดือน|วัน)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit.startsWith("month") || unit.startsWith("เดือน")) return Math.max(1, num * 4);
      if (unit.startsWith("day") || unit.startsWith("วัน")) return Math.max(1, Math.round(num / 7));
      return Math.max(1, num);
    }
    return 3;
  };

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
          segments: [],
          startCol: 0,
          totalSpanCols: 0,
          noStartDate: !proj.startDate,
          outOfRange: !!proj.startDate,
        };
      }

      const projectStartCol = startCol;
      let runningCol = projectStartCol;

      const timeFrames = proj.timeFrames && proj.timeFrames.length > 0
        ? proj.timeFrames
        : [
            { phase: "Concept Design", description: "Design concept", duration: "3 Weeks" },
            { phase: "3D Perspective", description: "3D Visuals", duration: "4 Weeks" },
            { phase: "Working Drawings", description: "Construction docs", duration: "4 Weeks" },
          ];

      const paymentTerms = proj.paymentTerms && proj.paymentTerms.length > 0
        ? proj.paymentTerms
        : [
            { milestone: "Deposit", paymentPercentage: 30, amount: proj.totalFee * 0.3 },
            { milestone: "3D Approval", paymentPercentage: 40, amount: proj.totalFee * 0.4 },
            { milestone: "Final Delivery", paymentPercentage: 30, amount: proj.totalFee * 0.3 },
          ];

      const segments = timeFrames.map((tf, segIdx) => {
        const segWeeks = parseWeeks(tf.duration);
        const startCol = runningCol;
        const endCol = Math.min(totalGridColumns, runningCol + segWeeks);
        runningCol = endCol;

        const color = MINIMAL_PASTEL_COLORS[segIdx % MINIMAL_PASTEL_COLORS.length];
        const payment = paymentTerms[segIdx] || paymentTerms[paymentTerms.length - 1];

        return {
          index: segIdx,
          phaseName: tf.phase.replace(/Phase \d+:\s*/i, ""),
          fullPhaseName: tf.phase,
          duration: tf.duration,
          weeks: segWeeks,
          startCol,
          endCol,
          spanCols: Math.max(1, endCol - startCol),
          color,
          paymentMilestone: payment?.milestone || `งวดที่ ${segIdx + 1}`,
          paymentPercentage: payment?.paymentPercentage || 25,
          paymentAmount: payment?.amount || (proj.totalFee * 0.25),
        };
      });

      return {
        project: proj,
        segments,
        startCol: projectStartCol,
        totalSpanCols: runningCol - projectStartCol,
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

                      {/* Right Column: Minimalist Pastel Gantt Bars */}
                      <div className="flex-1 relative p-3 flex items-center min-h-[76px] bg-white">
                        {row.segments.length === 0 ? (
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

                        {/* Stacked Solid Pastel Gantt Blocks Container */}
                        <div
                          className="relative z-10 grid w-full h-10 items-center"
                          style={{ gridTemplateColumns: `repeat(${totalGridColumns}, minmax(0, 1fr))` }}
                        >
                          {row.segments.map((seg, segIdx) => {
                            return (
                              <div
                                key={segIdx}
                                style={{
                                  gridColumn: `${seg.startCol + 1} / span ${seg.spanCols}`,
                                }}
                                onMouseEnter={() =>
                                  setActiveTooltip({
                                    projectName: proj.projectName,
                                    phaseName: seg.fullPhaseName,
                                    duration: seg.duration,
                                    paymentMilestone: seg.paymentMilestone,
                                    paymentPercentage: seg.paymentPercentage,
                                    paymentAmount: seg.paymentAmount,
                                    monthName: monthHeaders[Math.floor(seg.startCol / 4)]?.name || "",
                                  })
                                }
                                onMouseLeave={() => setActiveTooltip(null)}
                                className={`h-10 ${seg.color.bg} ${seg.color.text} rounded-md shadow-2xs font-semibold text-xs flex items-center justify-between px-3 cursor-pointer transition-all duration-150 hover:brightness-95 hover:shadow-xs hover:scale-[1.01] hover:z-20 overflow-hidden mx-0.5 border border-black/5`}
                              >
                                <span className="truncate font-bold tracking-tight text-[11px]">
                                  {seg.phaseName}
                                </span>
                                <span className="text-[9.5px] font-mono font-bold bg-black/10 px-1.5 py-0.5 rounded shrink-0 ml-1">
                                  {seg.paymentPercentage}%
                                </span>
                              </div>
                            );
                          })}
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

        {/* Hover Detail Tooltip Card */}
        {activeTooltip && (
          <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 flex flex-col items-center justify-center font-bold text-xs">
                <span>{activeTooltip.monthName}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    {activeTooltip.phaseName}
                  </h4>
                  <span className="text-[11px] font-medium text-slate-500">
                    ({activeTooltip.projectName})
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  ระยะเวลาดำเนินงาน: <strong className="text-slate-800">{activeTooltip.duration}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">รอบค่างวดชำระ (Payment Term)</span>
                <span className="text-xs font-bold text-slate-800">
                  {activeTooltip.paymentMilestone} ({activeTooltip.paymentPercentage}%)
                </span>
              </div>
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-extrabold text-sm rounded-lg shadow-2xs">
                ฿{Number(activeTooltip.paymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Color Palette Legend */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Phase & Payment Stages (Minimal Pastel Colors):</span>
            </div>

            <div className="flex items-center flex-wrap gap-4">
              {MINIMAL_PASTEL_COLORS.map((seg, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                  <span className={`w-3.5 h-3.5 rounded-sm ${seg.bg} border border-black/5 shadow-2xs`} />
                  <span>{seg.name}</span>
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
