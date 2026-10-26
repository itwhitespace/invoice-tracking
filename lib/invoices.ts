import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_ASSETS_BUCKET = "invoice-assets";

export interface IssuerCompany {
  company_key: string;
  name_th: string;
  name_en: string;
  address: string;
  tax_id: string;
  branch: string;
  phone: string;
  email: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_account_type: string;
  bank_branch: string;
  notes: string;
  logo_path: string | null;
  bank_logo_path?: string | null;
  created_at?: string;
}

// Thai tax ID: 13 digits shown as 0-1055-68193-05-2.
const TAX_ID_GROUPS = [1, 4, 5, 2, 1];

export function formatTaxId(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  const parts: string[] = [];
  let i = 0;
  for (const size of TAX_ID_GROUPS) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return parts.join("-");
}

export const taxIdDigitCount = (value: string) => value.replace(/\D/g, "").length;

export const issuerDisplayName = (c?: Pick<IssuerCompany, "name_th" | "name_en"> | null) =>
  c?.name_th?.trim() || c?.name_en?.trim() || "(ยังไม่ตั้งชื่อบริษัท)";

export const EMPTY_ISSUER: Omit<IssuerCompany, "company_key"> = {
  name_th: "",
  name_en: "",
  address: "",
  tax_id: "",
  branch: "สำนักงานใหญ่",
  phone: "",
  email: "",
  bank_account_name: "",
  bank_name: "",
  bank_account_no: "",
  bank_account_type: "",
  bank_branch: "",
  notes: "",
  logo_path: null,
  bank_logo_path: null,
};

export interface Customer {
  id: string;
  name: string;
  tax_id: string;
  branch: string;
  address: string;
  phone: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
}

export type CustomerSnapshot = Omit<Customer, "id">;

export interface InvoiceItem {
  description: string;
  detail: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export const itemAmount = (it: InvoiceItem) =>
  (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0);

export type InvoiceStatus = "draft" | "issued" | "void";

export interface Invoice {
  id: string;
  company_key: string;
  doc_no: string | null;
  status: InvoiceStatus;
  issue_date: string;
  credit_term_days: number;
  due_date: string | null;
  salesman: string;
  project_name: string;
  quotation_no: string;
  ref_document: string;
  ship_to: string;
  customer_id: string | null;
  customer: CustomerSnapshot;
  company: IssuerCompany | null;
  items: InvoiceItem[];
  discount: number;
  vat_rate: number;
  wht_rate: number;
  subtotal: number;
  after_discount: number;
  vat_amount: number;
  total: number;
  wht_amount: number;
  net_total: number;
  notes: string;
  created_by: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  signature_path: string | null;
  issued_at: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
}

export const EMPTY_CUSTOMER: CustomerSnapshot = {
  name: "",
  tax_id: "",
  branch: "สำนักงานใหญ่",
  address: "",
  phone: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
};

export const EMPTY_ITEM: InvoiceItem = { description: "", detail: "", quantity: 1, unit_price: 0, discount: 0 };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Same order as the printed summary: VAT and withholding tax are both
// calculated on the amount after discount (withholding is on the pre-VAT
// amount).
export function calculateInvoiceTotals(inv: Pick<Invoice, "items" | "discount" | "vat_rate" | "wht_rate">) {
  const subtotal = round2(inv.items.reduce((sum, it) => sum + itemAmount(it), 0));
  const after_discount = round2(subtotal - (Number(inv.discount) || 0));
  const vat_amount = round2((after_discount * (Number(inv.vat_rate) || 0)) / 100);
  const total = round2(after_discount + vat_amount);
  const wht_amount = round2((after_discount * (Number(inv.wht_rate) || 0)) / 100);
  const net_total = round2(total - wht_amount);
  return { subtotal, after_discount, vat_amount, total, wht_amount, net_total };
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + (Number(days) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// dd/mm/yyyy in the Buddhist year, as on the sample document.
export function formatThaiDate(isoDate?: string | null): string {
  if (!isoDate) return "";
  const m = isoDate.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
}

export const formatMoney2 = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Amount in Thai words, e.g. 9630 -> "เก้าพันหกร้อยสามสิบบาทถ้วน"
// ---------------------------------------------------------------------------
const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readUnderMillion(n: number): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const digit = Number(s[i]);
    const place = s.length - i - 1;
    if (digit === 0) continue;
    if (place === 1 && digit === 1) out += "สิบ";
    else if (place === 1 && digit === 2) out += "ยี่สิบ";
    else if (place === 0 && digit === 1 && s.length > 1) out += "เอ็ด";
    else out += DIGITS[digit] + PLACES[place];
  }
  return out;
}

function readInteger(n: number): string {
  if (n === 0) return "ศูนย์";
  let out = "";
  const millions: number[] = [];
  let rest = n;
  while (rest > 0) {
    millions.unshift(rest % 1_000_000);
    rest = Math.floor(rest / 1_000_000);
  }
  millions.forEach((chunk, i) => {
    if (chunk > 0) out += readUnderMillion(chunk);
    if (i < millions.length - 1) out += "ล้าน";
  });
  return out;
}

export function bahtText(amount: number): string {
  const satangTotal = Math.round(Math.abs(Number(amount) || 0) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  const prefix = amount < 0 ? "ลบ" : "";
  if (satang === 0) return `${prefix}${readInteger(baht)}บาทถ้วน`;
  return `${prefix}${baht > 0 ? readInteger(baht) + "บาท" : ""}${readInteger(satang)}สตางค์`;
}

// Private-bucket images (logos, signatures) are shown through short-lived
// signed URLs.
export async function signedAssetUrl(supabase: SupabaseClient | null, path?: string | null): Promise<string | null> {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from(INVOICE_ASSETS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) {
    console.warn("Could not load image:", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadInvoiceAsset(
  supabase: SupabaseClient,
  folder: "logos" | "signatures",
  baseName: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safe = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${folder}/${safe}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(INVOICE_ASSETS_BUCKET).upload(path, file, { upsert: false });
  return { path: error ? null : path, error: error ? error.message : null };
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, { label: string; classes: string }> = {
  draft: { label: "ฉบับร่าง", classes: "bg-slate-100 text-slate-700 border-slate-300" },
  issued: { label: "ออกแล้ว", classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  void: { label: "ยกเลิก", classes: "bg-red-100 text-red-800 border-red-300" },
};
