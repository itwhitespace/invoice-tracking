"use client";

import { useEffect } from "react";
import { SavedRecord, PaymentTermItem } from "@/lib/types";
import { getCompanyLabel } from "@/lib/company-utils";
import { formatDepartmentLabel } from "@/lib/department-utils";
import { formatProjectDuration, parseWeeksFromDuration } from "@/lib/timeframe-utils";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_BADGE_CLASSES,
  getPaymentStatusInfo,
} from "@/lib/payment-status-utils";
import { X, FileText, Calendar, CreditCard } from "lucide-react";

// Read-only views for phones. The mobile layout is view-only by design —
// every edit (status, dates, drag-to-reschedule, notes) stays on desktop,
// so nothing here writes back to the record.

const formatMoney = (n: number): string =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatThaiDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

// The status's own date when one is set, otherwise the planned date for the
// milestone's payment week counted from the project's Start Date.
const getDisplayDate = (pt: PaymentTermItem, startDate?: string): string => {
  const { date } = getPaymentStatusInfo(pt);
  if (date) return formatThaiDate(date);
  if (startDate && pt.paymentWeek) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!isNaN(start.getTime())) {
      start.setDate(start.getDate() + (pt.paymentWeek - 1) * 7);
      return formatThaiDate(start.toISOString().slice(0, 10));
    }
  }
  return "";
};

export function MobilePaymentTermRow({ pt, startDate }: { pt: PaymentTermItem; startDate?: string }) {
  const { status } = getPaymentStatusInfo(pt);
  const date = getDisplayDate(pt, startDate);
  return (
    <div className="py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900 break-words">{pt.milestone || "-"}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {pt.paymentWeek ? `Week ${pt.paymentWeek}` : "ยังไม่ระบุสัปดาห์"}
          {date ? ` • ${date}` : ""}
          {` • ${Number((pt.paymentPercentage || 0).toFixed(2))}%`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-mono font-bold text-slate-900">฿{formatMoney(pt.amount)}</p>
        <span
          className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${PAYMENT_STATUS_BADGE_CLASSES[status]}`}
        >
          {PAYMENT_STATUS_LABELS[status]}
        </span>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  verified: "bg-orange-100 text-orange-800 border-orange-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function ProposalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
        STATUS_BADGE[status] || STATUS_BADGE.pending
      }`}
    >
      {status}
    </span>
  );
}

export function MobileProposalSheet({ record, onClose }: { record: SavedRecord | null; onClose: () => void }) {
  // Stop the page underneath from scrolling while the sheet is open.
  useEffect(() => {
    if (!record) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [record]);

  if (!record) return null;

  const infoRows: [string, string][] = [
    ["Project by", record.companyName ? getCompanyLabel(record.companyName) : "-"],
    ["Department", record.department ? formatDepartmentLabel(record.department) : "-"],
    ["Start Date", formatThaiDate(record.startDate) || "-"],
    ["Duration", formatProjectDuration(record)],
    ["Approve Date", formatThaiDate(record.approvedAt) || "-"],
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-slate-100 flex flex-col md:hidden">
      <header className="h-14 px-4 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-1.5 -ml-1.5 text-slate-600 rounded-md active:bg-slate-100" aria-label="ปิด">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-bold text-slate-900 truncate flex-1">{record.projectName}</h2>
        <ProposalStatusBadge status={record.status} />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Total Fee (THB)</p>
          <p className="text-2xl font-mono font-black text-slate-900">{formatMoney(record.totalFee)}</p>
          <dl className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {infoRows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10.5px] text-slate-500">{label}</dt>
                <dd className="text-xs font-semibold text-slate-800 truncate">{value}</dd>
              </div>
            ))}
          </dl>
          {record.roadmapNote && (
            <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 whitespace-pre-wrap">
              {record.roadmapNote}
            </p>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
            <CreditCard className="w-4 h-4 text-slate-600" />
            Payment Term ({record.paymentTerms?.length || 0} งวด)
          </h3>
          {(record.paymentTerms || []).length === 0 ? (
            <p className="py-3 text-[11px] text-slate-400">ยังไม่มีงวดการจ่ายเงิน</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {record.paymentTerms.map((pt, idx) => (
                <MobilePaymentTermRow key={pt.id || idx} pt={pt} startDate={record.startDate} />
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
            <Calendar className="w-4 h-4 text-slate-600" />
            Time Frame ({record.timeFrames?.length || 0} Phases)
          </h3>
          {(record.timeFrames || []).length === 0 ? (
            <p className="py-3 text-[11px] text-slate-400">ยังไม่มีข้อมูล Time Frame</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {record.timeFrames.map((tf, idx) => (
                <div key={tf.id || idx} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 break-words">{tf.phase || "-"}</p>
                    {tf.description && <p className="text-[11px] text-slate-500 mt-0.5 break-words">{tf.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-mono font-bold text-slate-800">
                    {parseWeeksFromDuration(tf.duration)} Wk
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {record.pdfUrl && (
          <a
            href={record.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl active:bg-slate-700"
          >
            <FileText className="w-4 h-4" />
            เปิดไฟล์ PDF
          </a>
        )}
      </div>
    </div>
  );
}
