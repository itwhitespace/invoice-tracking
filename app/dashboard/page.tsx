"use client";

import { useEffect, useMemo, useState } from "react";
import { SavedRecord } from "@/lib/types";
import {
  getSupabaseClient,
  getSavedRecords,
  getDepartmentTargets,
  saveDepartmentTargetLocally,
  upsertDepartmentTargetRemote,
  departmentTargetKey,
} from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { formatDepartmentLabel } from "@/lib/department-utils";
import { COMPANY_DEPARTMENTS } from "@/lib/company-utils";
import {
  buildFiscalYearMonthHeadersForStartYear,
  buildTimelineForMonthHeaders,
  getFiscalYearStartYear,
  RoadmapMonthConfig,
} from "@/lib/roadmap-timeline";
import { LayoutDashboard, Loader2, ChevronLeft, ChevronRight, BarChart3, Pencil } from "lucide-react";
import { TargetEditModal } from "@/components/target-edit-modal";

interface CompanyStyle {
  name: string;
  shortLabel: string;
  headerBg: string;
  headerText: string;
  deptText: string;
  accent: string;
}

const COMPANIES: CompanyStyle[] = [
  {
    name: "Whitespace Partners",
    shortLabel: "WSPN — Whitespace Partners",
    headerBg: "bg-gradient-to-r from-[#1F4E78] to-[#2E6DA4]",
    headerText: "text-white",
    deptText: "text-slate-800",
    accent: "#1F4E78",
  },
  {
    name: "Whitespaceconnect",
    shortLabel: "WSCN — Whitespaceconnect",
    headerBg: "bg-gradient-to-r from-[#F5D400] to-[#FFEB6B]",
    headerText: "text-slate-900",
    deptText: "text-violet-700",
    accent: "#8B5CF6",
  },
];

const BAR_PALETTE = ["#F4A03C", "#FFD34D", "#8FCB7E", "#C55A11", "#4FB6C4", "#B08BD9"];

// Summary and Annual Billing tables — shown in thousands of baht (K THB) to
// keep figures compact and easy to scan.
const formatKThousands = (amount: number): string =>
  amount > 0 ? Math.round(amount / 1000).toLocaleString("en-US") : "-";

export default function DashboardPage() {
  const { settings } = useSettings();
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [fiscalYearStart, setFiscalYearStart] = useState(() => getFiscalYearStartYear());

  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    Promise.all([getSavedRecords(supabase), getDepartmentTargets(supabase)])
      .then(([recs, tgts]) => {
        setRecords(recs);
        setTargets(tgts);
      })
      .finally(() => setIsLoading(false));
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  const handleTargetChange = async (companyName: string, department: string, targetAmount: number) => {
    const key = departmentTargetKey(companyName, department, fiscalYearStart);
    setTargets((prev) => ({ ...prev, [key]: targetAmount }));
    saveDepartmentTargetLocally(key, targetAmount);

    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    if (supabase) {
      const { error } = await upsertDepartmentTargetRemote(supabase, {
        companyName,
        department,
        fiscalYearStart,
        targetAmount,
      });
      if (error) window.alert("บันทึก Target ขึ้น Supabase ไม่สำเร็จ: " + error);
    }
  };

  const approvedProjects = useMemo(() => records.filter((r) => r.status === "approved"), [records]);

  // Fixed to our Oct–Sep fiscal year — navigable with the </> buttons,
  // not auto-fit to the data like the Roadmap page and Excel export.
  const monthHeaders = useMemo(
    () => buildFiscalYearMonthHeadersForStartYear(fiscalYearStart),
    [fiscalYearStart]
  );
  const rangeLabel =
    monthHeaders.length > 0 ? `${monthHeaders[0].name} – ${monthHeaders[monthHeaders.length - 1].name}` : "";

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <LayoutDashboard className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-[11px] text-slate-500">สรุปยอดรวมรายเดือนตามแผนก แยกตามบริษัท</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full pl-1.5 pr-3 py-1.5">
          <button
            type="button"
            onClick={() => setFiscalYearStart((y) => y - 1)}
            title="รอบงบประมาณก่อนหน้า"
            className="w-7 h-7 rounded-full bg-slate-500 hover:bg-slate-700 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 font-mono whitespace-nowrap px-1">
            รอบงบประมาณ {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => setFiscalYearStart((y) => y + 1)}
            title="รอบงบประมาณถัดไป"
            className="w-7 h-7 rounded-full bg-slate-500 hover:bg-slate-700 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {COMPANIES.map((company) => (
                <CompanySummaryTable
                  key={company.name}
                  company={company}
                  projects={approvedProjects.filter((p) => p.companyName === company.name)}
                  monthHeaders={monthHeaders}
                />
              ))}
            </div>

            <div className="space-y-6">
              {COMPANIES.map((company) => (
                <AnnualBillingSection
                  key={company.name}
                  company={company}
                  projects={approvedProjects.filter((p) => p.companyName === company.name)}
                  monthHeaders={monthHeaders}
                  fiscalYearStart={fiscalYearStart}
                  targets={targets}
                  onTargetChange={handleTargetChange}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CompanySummaryTable({
  company,
  projects,
  monthHeaders,
}: {
  company: CompanyStyle;
  projects: SavedRecord[];
  monthHeaders: RoadmapMonthConfig[];
}) {
  const departments = COMPANY_DEPARTMENTS[company.name] || [];

  const deptRows = useMemo(
    () =>
      departments.map((dept) => {
        const deptProjects = projects.filter((p) => p.department === dept);
        const { monthlyTotals } = buildTimelineForMonthHeaders(deptProjects, monthHeaders);
        return { dept, monthlyTotals };
      }),
    [projects, monthHeaders, departments]
  );

  const totalRow = useMemo(
    () => buildTimelineForMonthHeaders(projects, monthHeaders).monthlyTotals,
    [projects, monthHeaders]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr>
              <th
                className={`p-3.5 sticky left-0 z-10 ${company.headerBg} ${company.headerText} font-bold whitespace-nowrap min-w-[200px] tracking-wide`}
              >
                {company.shortLabel}
                <span className="ml-1.5 font-normal opacity-75">(K THB)</span>
              </th>
              {monthHeaders.map((m, idx) => (
                <th
                  key={idx}
                  className="p-3.5 text-center font-bold text-slate-600 bg-slate-50/80 whitespace-nowrap border-b border-slate-200 min-w-[92px]"
                >
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deptRows.map(({ dept, monthlyTotals }, rowIdx) => (
              <tr
                key={dept}
                className={`hover:bg-indigo-50/40 transition-colors ${rowIdx % 2 === 1 ? "bg-slate-50/40" : ""}`}
              >
                <td className={`p-3.5 font-semibold sticky left-0 z-10 bg-white ${company.deptText}`}>
                  {formatDepartmentLabel(dept)}
                </td>
                {monthlyTotals.map((amt, idx) => (
                  <td
                    key={idx}
                    className={`p-3.5 text-center font-mono tabular-nums ${amt > 0 ? "text-slate-800 font-semibold" : "text-slate-300"}`}
                  >
                    {formatKThousands(amt)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-emerald-200 bg-emerald-50/70">
              <td className="p-4 text-right text-sm font-extrabold text-slate-900 tracking-wide sticky left-0 z-10 bg-emerald-50/70">
                Total
              </td>
              {totalRow.map((amt, idx) => (
                <td
                  key={idx}
                  className="p-4 text-center font-mono tabular-nums text-sm font-extrabold text-emerald-700"
                >
                  {formatKThousands(amt)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AnnualBillingSection({
  company,
  projects,
  monthHeaders,
  fiscalYearStart,
  targets,
  onTargetChange,
}: {
  company: CompanyStyle;
  projects: SavedRecord[];
  monthHeaders: RoadmapMonthConfig[];
  fiscalYearStart: number;
  targets: Record<string, number>;
  onTargetChange: (companyName: string, department: string, targetAmount: number) => void;
}) {
  const departments = COMPANY_DEPARTMENTS[company.name] || [];
  const [editingDept, setEditingDept] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      departments.map((dept) => {
        const deptProjects = projects.filter((p) => p.department === dept);
        const { monthlyTotals } = buildTimelineForMonthHeaders(deptProjects, monthHeaders);
        const actual = monthlyTotals.reduce((sum, v) => sum + v, 0);
        const key = departmentTargetKey(company.name, dept, fiscalYearStart);
        const target = targets[key] || 0;
        const pctComplete = target > 0 ? (actual / target) * 100 : 0;
        return { dept, actual, target, pctComplete };
      }),
    [projects, monthHeaders, departments, targets, company.name, fiscalYearStart]
  );

  const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  const maxPct = Math.max(...rows.map((r) => r.pctComplete), 1);
  const editingRow = rows.find((r) => r.dept === editingDept) || null;

  return (
    <div className="space-y-3">
      <div className={`px-5 py-3.5 rounded-xl ${company.headerBg} ${company.headerText} flex items-center gap-2 shadow-sm`}>
        <BarChart3 className="w-4 h-4" />
        <h3 className="text-sm font-bold tracking-wide">{company.shortLabel} — Annual Billing (K THB)</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Table — its own box */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-bold">Department</th>
                <th className="py-2 px-3 text-right font-bold">Target</th>
                <th className="py-2 px-3 text-right font-bold">Actual</th>
                <th className="py-2 pl-3 text-right font-bold">% Complete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.dept} className="hover:bg-slate-50/60 transition-colors">
                  <td className={`py-2 pr-3 font-semibold ${company.deptText}`}>{formatDepartmentLabel(r.dept)}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingDept(r.dept)}
                      title="แก้ไข Target"
                      className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-800 hover:text-indigo-600 transition-colors group"
                    >
                      {formatKThousands(r.target)}
                      <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                    {formatKThousands(r.actual)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <span
                      className={`font-mono font-bold ${
                        r.pctComplete >= 100 ? "text-emerald-600" : r.pctComplete >= 70 ? "text-amber-600" : "text-slate-500"
                      }`}
                    >
                      {r.target > 0 ? `${Math.round(r.pctComplete)}%` : "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-200 bg-emerald-50/70">
                <td className="py-3 pr-3 text-sm font-extrabold text-slate-900 tracking-wide">Total</td>
                <td className="py-3 px-3 text-right font-mono text-sm font-extrabold text-slate-900">
                  {formatKThousands(totalTarget)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-sm font-extrabold text-slate-900">
                  {formatKThousands(totalActual)}
                </td>
                <td className="py-3 pl-3 text-right font-mono text-base font-extrabold text-emerald-700">
                  {totalTarget > 0 ? `${Math.round(totalPct)}%` : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bar chart — separate box */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-end justify-around gap-4 h-48">
            {rows.map((r, idx) => {
              const heightPct = maxPct > 0 ? Math.max(2, (r.pctComplete / maxPct) * 100) : 2;
              return (
                <div key={r.dept} className="flex flex-col items-center justify-end h-full flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-slate-700 mb-1">
                    {r.target > 0 ? `${Math.round(r.pctComplete)}%` : "-"}
                  </span>
                  <div
                    className="w-full max-w-[44px] rounded-t-md transition-all"
                    style={{ height: `${heightPct}%`, backgroundColor: BAR_PALETTE[idx % BAR_PALETTE.length] }}
                  />
                  <div className="w-full border-t border-slate-300 mt-1 pt-1.5 text-center">
                    <span className="text-[10px] font-semibold text-slate-500 truncate block">
                      {formatDepartmentLabel(r.dept)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TargetEditModal
        isOpen={!!editingRow}
        companyLabel={company.shortLabel}
        departmentLabel={editingRow ? formatDepartmentLabel(editingRow.dept) : ""}
        currentAmount={editingRow?.target || 0}
        onCancel={() => setEditingDept(null)}
        onSave={(amount) => {
          if (editingDept) onTargetChange(company.name, editingDept, amount);
          setEditingDept(null);
        }}
      />
    </div>
  );
}
