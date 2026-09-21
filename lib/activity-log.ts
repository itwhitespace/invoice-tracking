import { SupabaseClient } from "@supabase/supabase-js";
import { SavedRecord } from "./types";
import { PAYMENT_STATUS_LABELS } from "./payment-status-utils";
import { formatThousands } from "./format-utils";

export type ActivityAction =
  | "approved"
  | "unapproved"
  | "total_fee_changed"
  | "payment_status_changed"
  | "payment_amount_changed"
  | "payment_week_moved";

export interface ActivityLogEntry {
  id: string;
  created_at: string;
  actor: string | null;
  action: ActivityAction;
  summary: string;
}

// Fire-and-forget — never blocks or fails the action it's logging alongside.
// Skipped entirely without a configured Supabase client (nothing to write
// to) or an empty entries list.
export async function logActivity(
  supabase: SupabaseClient | null,
  projectId: string,
  entries: { action: ActivityAction; summary: string }[]
): Promise<void> {
  if (!supabase || entries.length === 0) return;
  try {
    const { data } = await supabase.auth.getSession();
    const actor = data.session?.user?.email || null;
    await supabase.from("project_activity_log").insert(
      entries.map((e) => ({ project_id: projectId, actor, action: e.action, summary: e.summary }))
    );
  } catch (err) {
    console.warn("Failed to log activity:", err);
  }
}

export async function fetchActivityLog(
  supabase: SupabaseClient | null,
  projectId: string
): Promise<ActivityLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("project_activity_log")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.warn("Failed to fetch activity log:", error);
    return [];
  }
  return data as ActivityLogEntry[];
}

// Diffs the fields the Proposal detail modal's Save flow can change (Total
// Fee, and each Payment Term's amount/week) between what was passed in and
// what's about to be saved — used to log only what actually changed.
export function buildProposalChangeSummaries(
  oldRecord: SavedRecord,
  newRecord: SavedRecord
): { action: ActivityAction; summary: string }[] {
  const entries: { action: ActivityAction; summary: string }[] = [];

  if ((oldRecord.totalFee || 0) !== (newRecord.totalFee || 0)) {
    entries.push({
      action: "total_fee_changed",
      summary: `เปลี่ยน Total Fee จาก ฿${formatThousands(oldRecord.totalFee || 0)} เป็น ฿${formatThousands(newRecord.totalFee || 0)}`,
    });
  }

  const oldTermsById = new Map((oldRecord.paymentTerms || []).filter((t) => t.id).map((t) => [t.id, t]));
  for (const newTerm of newRecord.paymentTerms || []) {
    if (!newTerm.id) continue; // newly-added row in this same save — nothing to diff against
    const oldTerm = oldTermsById.get(newTerm.id);
    if (!oldTerm) continue;

    if ((oldTerm.amount || 0) !== (newTerm.amount || 0)) {
      entries.push({
        action: "payment_amount_changed",
        summary: `เปลี่ยนจำนวนเงินงวด "${newTerm.milestone}" จาก ฿${formatThousands(oldTerm.amount || 0)} เป็น ฿${formatThousands(newTerm.amount || 0)}`,
      });
    }

    if ((oldTerm.paymentWeek || null) !== (newTerm.paymentWeek || null)) {
      const oldWeek = oldTerm.paymentWeek ? `Week ${oldTerm.paymentWeek}` : "ยังไม่ระบุ";
      const newWeek = newTerm.paymentWeek ? `Week ${newTerm.paymentWeek}` : "ยังไม่ระบุ";
      entries.push({
        action: "payment_week_moved",
        summary: `ย้ายกำหนดเก็บเงินงวด "${newTerm.milestone}" จาก ${oldWeek} เป็น ${newWeek}`,
      });
    }
  }

  return entries;
}

export function paymentStatusChangeSummary(milestone: string, oldStatus: string, newStatus: string): string {
  const oldLabel = PAYMENT_STATUS_LABELS[oldStatus as keyof typeof PAYMENT_STATUS_LABELS] || oldStatus;
  const newLabel = PAYMENT_STATUS_LABELS[newStatus as keyof typeof PAYMENT_STATUS_LABELS] || newStatus;
  return `เปลี่ยนสถานะงวด "${milestone}" จาก ${oldLabel} เป็น ${newLabel}`;
}
