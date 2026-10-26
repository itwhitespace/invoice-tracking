"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ReceiptText, Undo2, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Invoice,
  PAYMENT_METHODS,
  Receipt,
  formatMoney2,
  formatThaiDate,
  invoiceDisplayStatus,
  todayIso,
} from "@/lib/invoices";
import { DateInputDDMMYYYY } from "@/components/date-input-ddmmyyyy";

export type PaymentInvoice = Pick<Invoice, "id" | "doc_no" | "status" | "due_date" | "net_total"> &
  Partial<
    Pick<
      Invoice,
      | "customer"
      | "project_name"
      | "issue_date"
      | "company"
      | "subtotal"
      | "discount"
      | "after_discount"
      | "vat_rate"
      | "vat_amount"
      | "total"
      | "wht_rate"
      | "wht_amount"
    >
  > & {
    payment_status?: string | null;
  };

export type ActiveReceipt = Pick<Receipt, "id" | "doc_no"> | null;

// "รับชำระ" → "ออกใบเสร็จ" → "ใบเสร็จ RE-…" for one issued invoice.
// `compact` renders small buttons for the list table.
export function InvoicePaymentActions({
  invoice,
  receipt,
  compact,
  canUndo,
  onChanged,
}: {
  invoice: PaymentInvoice;
  receipt: ActiveReceipt;
  compact?: boolean;
  canUndo?: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "paid" | "receipt">(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const status = invoiceDisplayStatus(invoice);
  if (status === "draft" || status === "void") return null;

  const openReceipt = (id: string) => router.push(`/invoices/receipts/${id}`);

  const undoPaid = async () => {
    if (!supabase || !window.confirm(`ยกเลิกสถานะ "ชำระเงินแล้ว" ของ ${invoice.doc_no}?`)) return;
    setIsBusy(true);
    const { error: e } = await supabase.rpc("unmark_invoice_paid", { p_invoice_id: invoice.id });
    setIsBusy(false);
    if (e) setError(e.message);
    else await onChanged();
  };

  const btn = compact
    ? "px-2 py-1 text-[11px] font-semibold rounded-md flex items-center gap-1 whitespace-nowrap disabled:opacity-60"
    : "px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60";

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {status !== "paid" ? (
        <button onClick={() => setDialog("paid")} disabled={isBusy} className={`${btn} text-white bg-emerald-600 hover:bg-emerald-700`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          รับชำระ
        </button>
      ) : receipt ? (
        <button
          onClick={() => openReceipt(receipt.id)}
          className={`${btn} text-white bg-purple-600 hover:bg-purple-700`}
          title={`ใบเสร็จ ${receipt.doc_no}`}
        >
          <ReceiptText className="w-3.5 h-3.5" />
          ดูใบเสร็จ
        </button>
      ) : (
        <>
          <button onClick={() => setDialog("receipt")} disabled={isBusy} className={`${btn} text-white bg-purple-600 hover:bg-purple-700`}>
            <ReceiptText className="w-3.5 h-3.5" />
            ออกใบเสร็จ
          </button>
          {canUndo && (
            <button onClick={undoPaid} disabled={isBusy} className={`${btn} text-slate-600 hover:bg-slate-100`} title="ยกเลิกสถานะชำระเงินแล้ว">
              <Undo2 className="w-3.5 h-3.5" />
              {!compact && "ยกเลิกสถานะชำระ"}
            </button>
          )}
        </>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}

      {dialog === "paid" && (
        <MarkPaidDialog
          invoice={invoice}
          onClose={() => setDialog(null)}
          onDone={async () => {
            setDialog(null);
            await onChanged();
          }}
        />
      )}
      {dialog === "receipt" && (
        <IssueReceiptDialog
          invoice={invoice}
          onClose={() => setDialog(null)}
          onDone={(receiptId) => {
            setDialog(null);
            openReceipt(receiptId);
          }}
        />
      )}
    </div>
  );
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const inputClass =
  "w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500";

// Receive the full invoice amount in one go: shows the invoice for review and
// records only the date, channel and an optional note.
function MarkPaidDialog({ invoice, onClose, onDone }: { invoice: PaymentInvoice; onClose: () => void; onDone: () => void }) {
  const supabase = getSupabaseClient();
  const bank = invoice.company;
  const bankOption =
    bank?.bank_name || bank?.bank_account_no
      ? `โอนเข้าบัญชี ${[bank.bank_name, bank.bank_account_no].filter(Boolean).join(" ")}`
      : null;
  const methods = bankOption ? [bankOption, ...PAYMENT_METHODS.filter((m) => m !== "โอนเงิน")] : PAYMENT_METHODS;
  const [paidAt, setPaidAt] = useState(todayIso());
  const [method, setMethod] = useState(methods[0]);
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const netTotal = Number(invoice.net_total) || 0;

  const save = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setError("");
    const { error: e } = await supabase.rpc("mark_invoice_paid", {
      p_invoice_id: invoice.id,
      p_paid_at: paidAt,
      p_method: method,
      p_amount: netTotal,
      p_note: note,
    });
    setIsBusy(false);
    if (e) setError("บันทึกไม่สำเร็จ: " + e.message);
    else onDone();
  };

  const summary: [string, number | undefined][] = [
    ["รวมเป็นเงิน", invoice.subtotal],
    ["หักส่วนลดพิเศษ", invoice.discount],
    ["ยอดรวมหลังหักส่วนลด", invoice.after_discount],
    ...(invoice.vat_rate ? ([[`ภาษีมูลค่าเพิ่ม ${invoice.vat_rate}%`, invoice.vat_amount]] as [string, number | undefined][]) : []),
    ["จำนวนเงินรวมทั้งสิ้น", invoice.total],
    [`หัก ณ ที่จ่าย ${invoice.wht_rate || 0}%`, invoice.wht_amount],
  ];

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl text-left">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              รับชำระเงิน <span className="font-mono">#{invoice.doc_no}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              มูลค่าที่ต้องรับชำระทั้งสิ้น <span className="font-semibold text-slate-800">{formatMoney2(netTotal)}</span> บาท
            </p>
          </div>
          <div className="w-44 shrink-0">
            <label className="text-[11px] font-semibold text-slate-600">
              วันที่รับชำระ <span className="text-red-500">*</span>
            </label>
            <DateInputDDMMYYYY value={paidAt} onChange={setPaidAt} className={`${inputClass} pr-8 mt-1`} />
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Invoice review */}
          <div className="grid grid-cols-4 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
            {[
              ["ลูกค้า", invoice.customer?.name],
              ["โปรเจกต์", invoice.project_name],
              ["วันที่ใบแจ้งหนี้", formatThaiDate(invoice.issue_date)],
              ["ครบกำหนดชำระ", formatThaiDate(invoice.due_date)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <div className="text-[10.5px] text-slate-500">{label}</div>
                <div className="font-semibold text-slate-800 truncate" title={value || ""}>
                  {value || "-"}
                </div>
              </div>
            ))}
          </div>

          {/* Payment channel */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900">ช่องทางการรับชำระเงิน</div>
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">รับชำระโดย</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">จำนวนเงินที่รับชำระ</label>
                <div className="px-2.5 py-1.5 text-xs text-right font-mono font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-md">
                  {formatMoney2(netTotal)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">หมายเหตุ</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เลขที่เช็ค / อ้างอิงการโอน" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Invoice totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-1 text-xs">
              {summary.map(([label, value]) => (
                <div key={label} className="flex justify-between text-slate-600">
                  <span>{label}</span>
                  <span className="font-mono">{formatMoney2(Number(value) || 0)} บาท</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-emerald-600 text-white px-4 py-3">
                <span className="text-xs font-semibold">รับชำระรวมทั้งสิ้น</span>
                <span className="text-lg font-bold font-mono">{formatMoney2(netTotal)} บาท</span>
              </div>
              <p className="text-[10.5px] text-slate-500 text-right">รับชำระเต็มจำนวนครั้งเดียว (1/1)</p>
            </div>
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-full">
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={isBusy || !paidAt}
            className="px-5 py-2 text-xs font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-full flex items-center gap-1.5"
          >
            {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            รับชำระเงิน
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function IssueReceiptDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: PaymentInvoice;
  onClose: () => void;
  onDone: (receiptId: string) => void;
}) {
  const supabase = getSupabaseClient();
  const [issueDate, setIssueDate] = useState(todayIso());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const issue = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setError("");
    const { data, error: e } = await supabase.rpc("issue_receipt", { p_invoice_id: invoice.id, p_issue_date: issueDate });
    setIsBusy(false);
    if (e || !data) setError("ออกใบเสร็จไม่สำเร็จ: " + (e?.message || ""));
    else onDone(data as string);
  };

  return (
    <DialogShell title={`ออกใบเสร็จรับเงิน — อ้างอิง ${invoice.doc_no}`} onClose={onClose}>
      <p className="text-xs text-slate-600 leading-relaxed">
        ระบบจะออกเลขที่ใบเสร็จ (RE-ปีเดือน + ลำดับ) ใช้ข้อมูลลูกค้าและรายการจากใบแจ้งหนี้ และใส่ลายเซ็นของคุณในช่องผู้รับเงิน
        หลังออกแล้วแก้ไขไม่ได้ ทำได้เพียงยกเลิก
      </p>
      <div className="space-y-1 text-xs">
        <label className="text-[11px] font-semibold text-slate-600">วันที่ใบเสร็จ</label>
        <DateInputDDMMYYYY value={issueDate} onChange={setIssueDate} className={`${inputClass} pr-8`} />
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
          ยกเลิก
        </button>
        <button
          onClick={issue}
          disabled={isBusy || !issueDate}
          className="flex-1 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 rounded-lg flex items-center justify-center gap-1.5"
        >
          {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          ออกใบเสร็จ
        </button>
      </div>
    </DialogShell>
  );
}
