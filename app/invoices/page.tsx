"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus, Loader2, Search, FileText, Printer } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Invoice,
  INVOICE_DISPLAY_STATUS,
  IssuerCompany,
  formatMoney2,
  formatThaiDate,
  invoiceDisplayStatus,
  issuerDisplayName,
} from "@/lib/invoices";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { ActiveReceipt, InvoicePaymentActions } from "@/components/invoice-payment-actions";

type InvoiceRow = Pick<
  Invoice,
  | "id"
  | "doc_no"
  | "status"
  | "company_key"
  | "issue_date"
  | "due_date"
  | "customer"
  | "project_name"
  | "net_total"
  | "issued_by_name"
  | "created_at"
  | "payment_status"
  | "company"
  | "subtotal"
  | "discount"
  | "after_discount"
  | "vat_rate"
  | "vat_amount"
  | "total"
  | "wht_rate"
  | "wht_amount"
>;

export default function InvoiceListPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [companies, setCompanies] = useState<IssuerCompany[]>([]);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, ActiveReceipt>>({});

  const openPreview = async (id: string) => {
    if (!supabase) return;
    setOpeningId(id);
    const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
    setOpeningId(null);
    if (error || !data) setLoadError(error?.message || "เปิดเอกสารไม่สำเร็จ");
    else setPreviewing(data as Invoice);
  };

  const load = useCallback(async () => {
    if (!supabase) return;
    const [comp, inv, rec] = await Promise.all([
      supabase.from("issuer_companies").select("*").order("created_at"),
      supabase
        .from("invoices")
        .select("id, doc_no, status, company_key, issue_date, due_date, customer, project_name, net_total, issued_by_name, created_at, payment_status, company, subtotal, discount, after_discount, vat_rate, vat_amount, total, wht_rate, wht_amount")
        .order("created_at", { ascending: false }),
      supabase.from("receipts").select("id, invoice_id, doc_no").eq("status", "issued"),
    ]);
    setCompanies((comp.data as IssuerCompany[]) || []);
    if (inv.error) setLoadError(inv.error.message);
    else setRows((inv.data as InvoiceRow[]) || []);
    const map: Record<string, ActiveReceipt> = {};
    for (const r of (rec.data as { id: string; invoice_id: string; doc_no: string }[]) || []) map[r.invoice_id] = r;
    setReceipts(map);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!companyFilter || r.company_key === companyFilter) &&
        (!q ||
          (r.doc_no || "").toLowerCase().includes(q) ||
          (r.customer?.name || "").toLowerCase().includes(q) ||
          (r.project_name || "").toLowerCase().includes(q))
    );
  }, [rows, companyFilter, query]);

  const companyName = (key: string) => issuerDisplayName(companies.find((c) => c.company_key === key));

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div>
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขที่ / ลูกค้า / โปรเจกต์..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          {companies.length > 1 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="">ทุกบริษัท</option>
              {companies.map((c) => (
                <option key={c.company_key} value={c.company_key}>
                  {issuerDisplayName(c)}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-slate-500 font-mono">{filtered.length} รายการ</span>
          <Link
            href="/invoices/new"
            className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
          >
            <FilePlus className="w-3.5 h-3.5" />
            สร้างใบแจ้งหนี้
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="p-6 text-xs text-red-700">
              โหลดรายการไม่สำเร็จ: {loadError}
              <p className="text-slate-500 mt-1">ถ้าเพิ่งเปิดใช้เมนูนี้ ให้รันไฟล์ supabase/invoices-setup.sql ก่อน</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
              <FileText className="w-8 h-8" />
              <p className="text-xs">{rows.length === 0 ? "ยังไม่มีใบแจ้งหนี้" : "ไม่พบรายการที่ตรงกับตัวกรอง"}</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">เลขที่</th>
                  <th className="px-3 py-3">วันที่</th>
                  <th className="px-3 py-3">บริษัทผู้ออก</th>
                  <th className="px-3 py-3">ลูกค้า</th>
                  <th className="px-3 py-3">โปรเจกต์</th>
                  <th className="px-3 py-3 text-right">ยอดชำระ (THB)</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-3 py-3">ผู้ออก</th>
                  <th className="px-3 py-3 w-20 text-center">ดู / พิมพ์</th>
                  <th className="px-3 py-3">การชำระเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => router.push(`/invoices/${r.id}`)} className="hover:bg-slate-50/70 cursor-pointer">
                    <td className="px-3 py-3 font-mono font-semibold text-slate-900">{r.doc_no || <span className="text-slate-400">— ร่าง —</span>}</td>
                    <td className="px-3 py-3 font-mono text-slate-600">{formatThaiDate(r.issue_date)}</td>
                    <td className="px-3 py-3 text-slate-600">{companyName(r.company_key)}</td>
                    <td className="px-3 py-3 text-slate-800">{r.customer?.name || "-"}</td>
                    <td className="px-3 py-3 text-slate-600 max-w-[280px] truncate" title={r.project_name}>{r.project_name || "-"}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">{formatMoney2(r.net_total)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${INVOICE_DISPLAY_STATUS[invoiceDisplayStatus(r)].classes}`}>
                        {INVOICE_DISPLAY_STATUS[invoiceDisplayStatus(r)].label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{r.issued_by_name || "-"}</td>
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {r.status !== "draft" ? (
                        <button
                          onClick={() => openPreview(r.id)}
                          title="ดูใบแจ้งหนี้และพิมพ์"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                        >
                          {openingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <InvoicePaymentActions invoice={r} receipt={receipts[r.id] || null} compact onChanged={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {previewing && <InvoicePreviewModal invoice={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
