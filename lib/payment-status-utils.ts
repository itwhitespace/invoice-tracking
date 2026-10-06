import { PaymentStatus, PaymentTermItem } from "./types";

// Single source of truth for how each payment status is labeled — used by
// the Project Roadmap (marker legend/tooltip/status picker) and the
// Proposal Preview detail modal's read-only status badge.
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  wait: "รอเก็บเงิน",
  invoice: "วางบิลแล้ว",
  paid: "เก็บเงินแล้ว",
  hold: "พักไว้ก่อน (Hold)",
  cancelled: "ยกเลิกงาน",
};

// Badge colors matching the Roadmap's payment-marker palette — used by the
// read-only mobile views.
export const PAYMENT_STATUS_BADGE_CLASSES: Record<PaymentStatus, string> = {
  wait: "bg-amber-100 border-amber-300 text-amber-900",
  invoice: "bg-sky-100 border-sky-300 text-sky-900",
  paid: "bg-emerald-100 border-emerald-300 text-emerald-900",
  hold: "bg-violet-100 border-violet-300 text-violet-900",
  cancelled: "bg-red-100 border-red-300 text-red-900",
};

// Hold and Cancelled installments are left out of every money total
// (Roadmap monthly totals, Dashboard Summary/Annual Billing, Excel export).
export const isExcludedFromTotals = (status: PaymentStatus): boolean =>
  status === "hold" || status === "cancelled";

// Resolves the date that belongs to a payment term's current status — the
// same rule the detail modal's "วันที่ของสถานะ" column uses. A term with no
// explicit status yet defaults to Wait.
export const getPaymentStatusInfo = (pt: PaymentTermItem): { status: PaymentStatus; date?: string } => {
  const status = pt.paymentStatus || "wait";
  const date = status === "paid" ? pt.paidDate : status === "invoice" ? pt.invoiceIssuedDate : pt.invoiceDate;
  return { status, date };
};
