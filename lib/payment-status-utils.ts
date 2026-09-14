import { PaymentStatus } from "./types";

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
