"use client";

import { useEffect, useMemo, useState } from "react";
import { SavedRecord } from "@/lib/types";
import { getSupabaseClient, getSavedRecords } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { formatDepartmentLabel } from "@/lib/department-utils";
import { COMPANY_DEPARTMENTS } from "@/lib/company-utils";
import {
  buildFiscalYearMonthHeaders,
  buildTimelineForMonthHeaders,
  RoadmapMonthConfig,
} from "@/lib/roadmap-timeline";
import { LayoutDashboard, Loader2 } from "lucide-react";

interface CompanyStyle {
  name: string;
  shortLabel: string;
  headerBg: string;
  headerText: string;
  deptText: string;
}

const COMPANIES: CompanyStyle[] = [
  {
    name: "Whitespace Partners",
    shortLabel: "WSPN — Whitespace Partners",
    headerBg: "bg-[#1F4E78]",
    headerText: "text-white",
    deptText: "text-slate-800",
  },
  {
    name: "Whitespaceconnect",
    shortLabel: "WSCN — Whitespaceconnect",
    headerBg: "bg-[#FFFF00]",
    headerText: "text-slate-900",
    deptText: "text-violet-700",
  },
];

const formatAmount = (amount: number): string =>
  amount > 0 ? `฿${amount.toLocaleString("en-US")}` : "-";

export default function DashboardPage() {
  const { settings } = useSettings();
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    getSavedRecords(supabase)
      .then(setRecords)
      .finally(() => setIsLoading(false));
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  const approvedProjects = useMemo(() => records.filter((r) => r.status === "approved"), [records]);

  // Fixed to our Oct–Sep fiscal year (the one the current date falls in) —
  // not auto-fit to the data, unlike the Roadmap page and Excel export.
  const monthHeaders = useMemo(() => buildFiscalYearMonthHeaders(), []);
  const rangeLabel =
    monthHeaders.length > 0 ? `${monthHeaders[0].name} – ${monthHeaders[monthHeaders.length - 1].name}` : "";

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <LayoutDashboard className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-[11px] text-slate-500">
              สรุปยอดรวมรายเดือนตามแผนก แยกตามบริษัท • รอบงบประมาณ {rangeLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          COMPANIES.map((company) => (
            <CompanySummaryTable
              key={company.name}
              company={company}
              projects={approvedProjects.filter((p) => p.companyName === company.name)}
              monthHeaders={monthHeaders}
            />
          ))
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr>
              <th
                className={`p-3 sticky left-0 z-10 ${company.headerBg} ${company.headerText} font-bold whitespace-nowrap min-w-[200px]`}
              >
                {company.shortLabel}
              </th>
              {monthHeaders.map((m, idx) => (
                <th
                  key={idx}
                  className="p-3 text-center font-bold text-slate-700 bg-slate-50 whitespace-nowrap border-b border-slate-200 min-w-[92px]"
                >
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deptRows.map(({ dept, monthlyTotals }) => (
              <tr key={dept} className="hover:bg-slate-50/60 transition-colors">
                <td className={`p-3 font-semibold sticky left-0 z-10 bg-white ${company.deptText}`}>
                  {formatDepartmentLabel(dept)}
                </td>
                {monthlyTotals.map((amt, idx) => (
                  <td key={idx} className="p-3 text-center font-mono text-slate-700">
                    {formatAmount(amt)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="p-3 text-right font-bold text-slate-900 sticky left-0 z-10 bg-slate-50">Total</td>
              {totalRow.map((amt, idx) => (
                <td key={idx} className="p-3 text-center font-mono font-bold text-emerald-700">
                  {formatAmount(amt)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
