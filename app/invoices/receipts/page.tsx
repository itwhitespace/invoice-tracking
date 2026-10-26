"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, ReceiptText, Search } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { IssuerCompany, Receipt, formatMoney2, formatThaiDate, issuerDisplayName } from "@/lib/invoices";
import { receiptToDocument } from "@/lib/receipts";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";

export default function ReceiptListPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [companies, setCompanies] = useState<IssuerCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [rec, comp] = await Promise.all([
      supabase.from("receipts").select("*").order("created_at", { ascending: false }),
      supabase.from("issuer_companies").select("*"),
    ]);
    if (rec.error) setLoadError(rec.error.message);
    else setRows((rec.data as Receipt[]) || []);
    setCompanies((comp.data as IssuerCompany[]) || []);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        r.doc_no.toLowerCase().includes(q) ||
        r.invoice_doc_no.toLowerCase().includes(q) ||
        (r.data.customer?.name || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const companyName = (key: string) => issuerDisplayName(companies.find((c) => c.company_key === key));

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเลขที่ใบเสร็จ / ใบแจ้งหนี้ / ลูกค้า..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-500 font-mono">{filtered.length} รายการ</span>
        <span className="ml-auto text-[11px] text-slate-500">ออกใบเสร็จได้จากใบแจ้งหนี้ที่บันทึก &quot;ชำระเงินแล้ว&quot;</span>
      </div>

      {loadError && <div className="mb-3 text-xs text-red-700">{loadError}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-x-auto">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
            <ReceiptText className="w-8 h-8" />
            <p className="text-xs">{rows.length === 0 ? "ยังไม่มีใบเสร็จรับเงิน" : "ไม่พบรายการที่ค้นหา"}</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-3">เลขที่ใบเสร็จ</th>
                <th className="px-3 py-3">วันที่</th>
                <th className="px-3 py-3">อ้างอิงใบแจ้งหนี้</th>
                <th className="px-3 py-3">บริษัทผู้ออก</th>
                <th className="px-3 py-3">ลูกค้า</th>
                <th className="px-3 py-3 text-right">ยอดที่ได้รับ (THB)</th>
                <th className="px-3 py-3">ชำระโดย</th>
                <th className="px-3 py-3">สถานะ</th>
                <th className="px-3 py-3">ผู้ออก</th>
                <th className="px-3 py-3 text-center">ดู / พิมพ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/invoices/receipts/${r.id}`)} className="hover:bg-slate-50/70 cursor-pointer">
                  <td className="px-3 py-3 font-mono font-semibold text-slate-900">{r.doc_no}</td>
                  <td className="px-3 py-3 font-mono text-slate-600">{formatThaiDate(r.issue_date)}</td>
                  <td className="px-3 py-3 font-mono text-slate-600">{r.invoice_doc_no}</td>
                  <td className="px-3 py-3 text-slate-600">{companyName(r.company_key)}</td>
                  <td className="px-3 py-3 text-slate-800">{r.data.customer?.name || "-"}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">{formatMoney2(r.paid_amount ?? r.data.net_total)}</td>
                  <td className="px-3 py-3 text-slate-600">{r.payment_method || "-"}</td>
                  <td className="px-3 py-3">
                    {r.status === "void" ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-slate-200 text-slate-500 border-slate-300 line-through">ยกเลิก</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300">ออกแล้ว</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{r.issued_by_name || "-"}</td>
                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setPreviewing(r)} title="ดูใบเสร็จและพิมพ์" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md">
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previewing && <InvoicePreviewModal invoice={receiptToDocument(previewing)} onClose={() => setPreviewing(null)} />}

    </div>
  );
}
