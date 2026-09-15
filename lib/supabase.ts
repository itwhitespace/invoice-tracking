import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ExtractedProjectData, SavedRecord, TimeFrameItem, PaymentTermItem } from "./types";

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
    totalFee: Number(row.total_fee) || 0,
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
        invoiceIssuedDate: pt.invoice_issued_date ?? undefined,
        paidDate: pt.paid_date ?? undefined,
      })),
    pdfUrl: row.pdf_url || "",
    pdfFileName: row.pdf_file_name || "",
    status: row.status,
    startDate: row.start_date || "",
    department: row.department || "",
    approvedAt: row.approved_at || "",
    roadmapNote: row.roadmap_note || "",
  };
}

export async function fetchRemoteSavedRecords(supabase: SupabaseClient): Promise<SavedRecord[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_timeframes(*), project_payment_terms(*)")
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
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        company_name: record.companyName || "",
        project_name: record.projectName,
        total_fee: record.totalFee,
        total_design_duration: record.totalDesignDuration || "",
        status: record.status,
        start_date: record.startDate || null,
        department: record.department || null,
        approved_at: record.approvedAt || null,
        roadmap_note: record.roadmapNote || null,
      })
      .eq("id", record.id);

    if (updateError) return { error: updateError.message };

    // Update each timeframe row in place by its own id (same per-row
    // pattern as payment terms below, for the same race-safety reason).
    for (const tf of record.timeFrames || []) {
      if (!tf.id) continue;
      const { error: tfError } = await supabase
        .from("project_timeframes")
        .update({
          phase: tf.phase,
          description: tf.description,
          duration: tf.duration,
        })
        .eq("id", tf.id);
      if (tfError) return { error: tfError.message };
    }

    // Update each payment term row in place by its own id — NOT a
    // delete-then-insert of the whole set. A delete-then-insert lets two
    // overlapping save calls (e.g. a double-click on Save) interleave into
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
          invoice_issued_date: pt.invoiceIssuedDate || null,
          paid_date: pt.paidDate || null,
        })
        .eq("id", pt.id);
      if (ptError) return { error: ptError.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

// Shared by the PDF-upload flow and the manual "Add Proposal" form — both
// end up creating one `projects` row plus its `project_timeframes` and
// `project_payment_terms` child rows the same way.
export async function insertProjectRemote(
  supabase: SupabaseClient,
  params: {
    companyName: string;
    projectName: string;
    totalFee: number;
    totalDesignDuration: string;
    pdfUrl: string;
    pdfFileName: string;
    status: SavedRecord["status"];
    timeFrames: TimeFrameItem[];
    paymentTerms: PaymentTermItem[];
  }
): Promise<{ projectId: string | null; error: string | null }> {
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .insert({
      company_name: params.companyName || "",
      project_name: params.projectName,
      total_fee: params.totalFee,
      total_design_duration: params.totalDesignDuration || "",
      pdf_url: params.pdfUrl,
      pdf_file_name: params.pdfFileName,
      status: params.status,
    })
    .select()
    .single();

  if (projectError || !projectRow) {
    return { projectId: null, error: projectError?.message || "Insert failed" };
  }

  const projectId = projectRow.id;

  if (params.timeFrames.length > 0) {
    await supabase.from("project_timeframes").insert(
      params.timeFrames.map((tf, i) => ({
        project_id: projectId,
        phase: tf.phase,
        description: tf.description,
        duration: tf.duration,
        sort_order: i,
      }))
    );
  }

  if (params.paymentTerms.length > 0) {
    await supabase.from("project_payment_terms").insert(
      params.paymentTerms.map((pt, i) => ({
        project_id: projectId,
        milestone: pt.milestone,
        payment_percentage: pt.paymentPercentage,
        amount: pt.amount,
        payment_week: pt.paymentWeek ?? null,
        invoice_date: pt.invoiceDate || null,
        payment_status: pt.paymentStatus || null,
        invoice_issued_date: pt.invoiceIssuedDate || null,
        paid_date: pt.paidDate || null,
        sort_order: i,
      }))
    );
  }

  return { projectId, error: null };
}

export async function deleteRecordRemote(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// --- Dashboard "Annual Billing" targets ---------------------------------
// Keyed by "<companyName>::<department>::<fiscalYearStart>" — a plain map
// is simplest here since the whole table is tiny (a handful of rows per
// company per fiscal year) and always loaded in full.

export function departmentTargetKey(companyName: string, department: string, fiscalYearStart: number): string {
  return `${companyName}::${department}::${fiscalYearStart}`;
}

const LOCAL_TARGETS_KEY = "invoice_tracking_department_targets";

export function getLocalDepartmentTargets(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_TARGETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Error reading local department targets:", err);
    return {};
  }
}

export function saveDepartmentTargetLocally(key: string, targetAmount: number) {
  if (typeof window === "undefined") return;
  try {
    const targets = getLocalDepartmentTargets();
    targets[key] = targetAmount;
    localStorage.setItem(LOCAL_TARGETS_KEY, JSON.stringify(targets));
  } catch (err) {
    console.error("Error saving local department target:", err);
  }
}

// Loads every stored target (Supabase merged over local fallback, same
// merge shape as getSavedRecords) as a flat key -> amount map.
export async function getDepartmentTargets(supabase: SupabaseClient | null): Promise<Record<string, number>> {
  const local = getLocalDepartmentTargets();
  if (!supabase) return local;

  const { data, error } = await supabase.from("department_targets").select("*");
  if (error || !data) {
    console.warn("Failed to fetch remote department targets:", error);
    return local;
  }

  const remote: Record<string, number> = {};
  for (const row of data) {
    remote[departmentTargetKey(row.company_name, row.department, row.fiscal_year_start)] = Number(row.target_amount) || 0;
  }
  return { ...local, ...remote };
}

export async function upsertDepartmentTargetRemote(
  supabase: SupabaseClient,
  params: { companyName: string; department: string; fiscalYearStart: number; targetAmount: number }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("department_targets")
    .upsert(
      {
        company_name: params.companyName,
        department: params.department,
        fiscal_year_start: params.fiscalYearStart,
        target_amount: params.targetAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_name,department,fiscal_year_start" }
    );
  return { error: error ? error.message : null };
}
