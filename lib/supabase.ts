import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ExtractedProjectData, SavedRecord } from "./types";

// Create client using environment variables or user provided settings from localStorage
export function getSupabaseClient(customUrl?: string, customKey?: string) {
  const rawUrl = (customUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (customKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!rawUrl || !key) {
    return null;
  }

  // Tolerate a URL pasted without the protocol (e.g. "xxxx.supabase.co").
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  try {
    new URL(url);
  } catch {
    console.warn("Invalid Supabase URL, skipping Supabase sync:", rawUrl);
    return null;
  }

  try {
    return createClient(url, key);
  } catch (error) {
    // Expected/handled failure path (bad user input) — warn, don't error,
    // so it doesn't trigger Next's intrusive dev error overlay.
    console.warn("Failed to initialize Supabase client:", error);
    return null;
  }
}

export function isValidSupabaseUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return true; // empty is allowed (Supabase sync just stays off)
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Local storage key for records history fallback
const LOCAL_HISTORY_KEY = "invoice_tracking_saved_records";

export function getLocalSavedRecords(): SavedRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error reading local saved records:", err);
    return [];
  }
}

export function saveRecordLocally(record: SavedRecord): SavedRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const records = getLocalSavedRecords();
    const updated = [record, ...records.filter((r) => r.id !== record.id)];
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Error saving local record:", err);
    return [];
  }
}

export function deleteRecordLocally(id: string): SavedRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const records = getLocalSavedRecords();
    const updated = records.filter((r) => r.id !== id);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Error deleting local record:", err);
    return [];
  }
}

// A record only lives in Supabase if its id is a real uuid (assigned by the
// `projects` table's default). Records saved while Supabase was unreachable
// keep a local `rec_<timestamp>` id and must never be sent in a `.eq("id", …)`
// filter against a uuid column (Postgres throws on the type mismatch).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRemoteId(id: string): boolean {
  return UUID_RE.test(id);
}

function mapProjectRowToRecord(row: any): SavedRecord {
  return {
    id: row.id,
    created_at: row.created_at,
    companyName: row.company_name || "",
    projectName: row.project_name,
    area: row.area || "",
    scopeOfWork: row.scope_of_work || "",
    totalFee: Number(row.total_fee) || 0,
    designFeeItems: (row.project_design_fee_items || [])
      .slice()
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((fi: any) => ({ id: fi.id, item: fi.item, description: fi.description || "", amount: Number(fi.amount) || 0 })),
    specialDiscount: Number(row.special_discount) || 0,
    timeFrames: (row.project_timeframes || [])
      .slice()
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((tf: any) => ({ id: tf.id, phase: tf.phase, description: tf.description || "", duration: tf.duration || "" })),
    totalDesignDuration: row.total_design_duration || "",
    paymentTerms: (row.project_payment_terms || [])
      .slice()
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((pt: any) => ({
        id: pt.id,
        milestone: pt.milestone,
        paymentPercentage: Number(pt.payment_percentage) || 0,
        amount: Number(pt.amount) || 0,
        paymentWeek: pt.payment_week ?? undefined,
        invoiceDate: pt.invoice_date ?? undefined,
        paymentStatus: pt.payment_status ?? undefined,
      })),
    pdfUrl: row.pdf_url || "",
    pdfFileName: row.pdf_file_name || "",
    status: row.status,
    startDate: row.start_date || "",
    department: row.department || "",
    approvedAt: row.approved_at || "",
  };
}

export async function fetchRemoteSavedRecords(supabase: SupabaseClient): Promise<SavedRecord[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_design_fee_items(*), project_timeframes(*), project_payment_terms(*)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("Failed to fetch remote saved records:", error);
    return [];
  }
  return data.map(mapProjectRowToRecord);
}

// Loads the record list from Supabase (source of truth, shared across every
// device) merged with any records that only exist in this browser's local
// history — e.g. saved while Supabase was unreachable and never synced.
export async function getSavedRecords(supabase: SupabaseClient | null): Promise<SavedRecord[]> {
  const local = getLocalSavedRecords();
  if (!supabase) return local;

  const remote = await fetchRemoteSavedRecords(supabase);
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter((r) => !remoteIds.has(r.id) && !isRemoteId(r.id));
  return [...remote, ...localOnly];
}

export async function updateRecordRemote(
  supabase: SupabaseClient,
  record: SavedRecord
): Promise<{ error: string | null }> {
  try {
    const vatAmount = record.totalFee * 0.07;
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        company_name: record.companyName || "",
        project_name: record.projectName,
        area: record.area,
        scope_of_work: record.scopeOfWork,
        total_fee: record.totalFee,
        special_discount: record.specialDiscount || 0,
        vat_amount: vatAmount,
        grand_total: record.totalFee + vatAmount,
        total_design_duration: record.totalDesignDuration || "",
        status: record.status,
        start_date: record.startDate || null,
        department: record.department || null,
        approved_at: record.approvedAt || null,
      })
      .eq("id", record.id);

    if (updateError) return { error: updateError.message };

    // Update each payment term row in place by its own id — NOT a
    // delete-then-insert of the whole set. Field edits in the detail modal
    // fire one onUpdate() per keystroke/selection, so concurrent calls are
    // expected; delete+insert let two overlapping calls interleave into
    // duplicate rows (a delete wiping nothing followed by two inserts).
    // Per-row updates are safe under that race — each just overwrites the
    // same row regardless of ordering.
    for (const pt of record.paymentTerms) {
      if (!pt.id) continue; // no matching remote row yet (shouldn't happen from the edit flow)
      const { error: ptError } = await supabase
        .from("project_payment_terms")
        .update({
          milestone: pt.milestone,
          payment_percentage: pt.paymentPercentage,
          amount: pt.amount,
          payment_week: pt.paymentWeek ?? null,
          invoice_date: pt.invoiceDate || null,
          payment_status: pt.paymentStatus || null,
        })
        .eq("id", pt.id);
      if (ptError) return { error: ptError.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function deleteRecordRemote(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return { error: error ? error.message : null };
}
