"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Receipt, formatMoney2, formatThaiDate, itemAmount, signedAssetUrl } from "@/lib/invoices";
import { receiptToDocument } from "@/lib/receipts";
import { InvoiceDocument } from "@/components/invoice-document";
import { DownloadPdfButton, PrintDocumentButton } from "@/components/document-actions";

const A4_WIDTH_PX = 794;

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const supabase = getSupabaseClient();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.7);
  const previewRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: e } = await supabase.from("receipts").select("*").eq("id", params.id).maybeSingle();
    if (e || !data) setError("ไม่พบใบเสร็จนี้ หรือไม่มีสิทธิ์เปิด");
    else setReceipt(data as Receipt);
  }, [supabase, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!receipt) return;
    signedAssetUrl(supabase, receipt.data.company?.logo_path).then(setLogoUrl);
    signedAssetUrl(supabase, receipt.signature_path).then(setSignatureUrl);
  }, [supabase, receipt]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => setPreviewScale(Math.min(1.2, Math.max(0.3, (el.clientWidth - 32) / A4_WIDTH_PX)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [receipt === null]);

  const voidReceipt = async () => {
    if (!supabase || !receipt) return;
    setIsBusy(true);
    const { error: e } = await supabase.rpc("void_receipt", { p_receipt_id: receipt.id, p_reason: voidReason });
    setIsBusy(false);
    setConfirmVoid(false);
    if (e) setError("ยกเลิกไม่สำเร็จ: " + e.message);
    else await load();
  };

  if (!receipt) {
    return error ? (
      <div className="p-8 text-xs text-red-700">{error}</div>
    ) : (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const doc = receiptToDocument(receipt);
  const d = receipt.data;
  const card = "bg-white border border-slate-200 rounded-xl p-4";
  const field = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <div className="text-[10.5px] text-slate-500">{label}</div>
      <div className="text-xs font-semibold text-slate-800 break-words">{value || "-"}</div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Action bar */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
        <Link href="/invoices/receipts" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" title="กลับไปรายการใบเสร็จ">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-bold text-slate-900 font-mono">{receipt.doc_no}</span>
        {receipt.status === "void" ? (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-slate-200 text-slate-500 border-slate-300 line-through">ยกเลิก</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-purple-100 text-purple-800 border-purple-300">ใบเสร็จรับเงิน</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {receipt.status === "issued" && (
            <button onClick={() => setConfirmVoid(true)} className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              ยกเลิกใบเสร็จ
            </button>
          )}
          <DownloadPdfButton data={doc} signaturePath={receipt.signature_path} />
          <PrintDocumentButton data={doc} signaturePath={receipt.signature_path} />
        </div>
      </div>

      {error && <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-[11.5px] text-red-800">{error}</div>}
      {receipt.status === "void" && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-[11.5px] text-red-800">
          ใบเสร็จนี้ถูกยกเลิกแล้ว{receipt.void_reason ? ` — เหตุผล: ${receipt.void_reason}` : ""}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Details */}
        <div className="w-1/2 min-w-0 overflow-y-auto p-6 space-y-5">
          <section className={card}>
            <h3 className="text-xs font-bold text-slate-900 mb-3">การรับชำระ</h3>
            <div className="grid grid-cols-3 gap-3">
              {field(
                "อ้างอิงใบแจ้งหนี้",
                <Link href={`/invoices/${receipt.invoice_id}`} className="font-mono text-indigo-600 hover:underline">
                  {receipt.invoice_doc_no}
                </Link>
              )}
              {field("วันที่ใบเสร็จ", formatThaiDate(receipt.issue_date))}
              {field("วันที่รับชำระ", formatThaiDate(receipt.paid_at))}
              {field("รับชำระโดย", receipt.payment_method)}
              {field("จำนวนเงินที่รับชำระ", receipt.paid_amount != null ? `฿${formatMoney2(receipt.paid_amount)}` : "-")}
              {field("หมายเหตุ", receipt.payment_note)}
            </div>
          </section>

          <section className={card}>
            <h3 className="text-xs font-bold text-slate-900 mb-3">ลูกค้า</h3>
            <div className="grid grid-cols-2 gap-3">
              {field("ชื่อลูกค้า", d.customer?.name)}
              {field("เลขประจำตัวผู้เสียภาษี", d.customer?.tax_id ? `${d.customer.tax_id}${d.customer.branch ? ` (${d.customer.branch})` : ""}` : "")}
              <div className="col-span-2">{field("ที่อยู่", d.customer?.address)}</div>
              {field("ผู้ติดต่อ", d.customer?.contact_name)}
              {field("อีเมลผู้ติดต่อ", d.customer?.contact_email)}
              {field("ชื่อโปรเจกต์", d.project_name)}
              {field("พนักงานขาย", d.salesman)}
            </div>
          </section>

          <section className={card}>
            <h3 className="text-xs font-bold text-slate-900 mb-3">รายการ</h3>
            <table className="w-full text-xs">
              <thead className="text-[11px] text-slate-500">
                <tr>
                  <th className="text-left font-semibold pb-1.5 w-8">#</th>
                  <th className="text-left font-semibold pb-1.5">รายการ</th>
                  <th className="text-center font-semibold pb-1.5 w-16">จำนวน</th>
                  <th className="text-right font-semibold pb-1.5 w-28">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="py-2 text-slate-400 font-mono">{i + 1}</td>
                    <td className="py-2">
                      <div className="font-semibold text-slate-800">{it.description}</div>
                      {it.detail && <div className="text-[11px] text-slate-500 whitespace-pre-line">{it.detail}</div>}
                    </td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right font-mono">{formatMoney2(itemAmount(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-slate-200 ml-auto max-w-xs space-y-1 text-xs">
              {(
                [
                  ["รวมเป็นเงิน", d.subtotal],
                  ["หักส่วนลดพิเศษ", d.discount],
                  ["ยอดรวมหลังหักส่วนลด", d.after_discount],
                  ...(d.vat_rate ? [[`VAT ${d.vat_rate}%`, d.vat_amount]] : []),
                  ["จำนวนเงินรวมทั้งสิ้น", d.total],
                  [`หัก ณ ที่จ่าย ${d.wht_rate || 0}%`, d.wht_amount],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between text-slate-600">
                  <span>{label}</span>
                  <span className="font-mono">{formatMoney2(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                <span>ยอดชำระ</span>
                <span className="font-mono">{formatMoney2(d.net_total)}</span>
              </div>
            </div>
          </section>

          <p className="text-[11px] text-slate-500">
            ออกโดย {receipt.issued_by_name || "-"} เมื่อ {new Date(receipt.issued_at).toLocaleString("th-TH")}
          </p>
        </div>

        {/* Live preview */}
        <div ref={previewRef} className="w-1/2 min-w-0 overflow-y-auto bg-slate-200/70 border-l border-slate-200 p-4">
          <p className="text-[10.5px] text-slate-500 mb-2 text-center">ตัวอย่างเอกสาร</p>
          <div
            style={{ width: A4_WIDTH_PX * previewScale, height: A4_WIDTH_PX * Math.SQRT2 * previewScale }}
            className="mx-auto shadow-lg overflow-hidden"
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <InvoiceDocument data={doc} logoUrl={logoUrl} signatureUrl={signatureUrl} copyLabel="ต้นฉบับ / Original" />
            </div>
          </div>
        </div>
      </div>

      {confirmVoid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">ยกเลิกใบเสร็จ {receipt.doc_no}</h3>
            <p className="text-xs text-slate-600">
              ใบเสร็จจะถูกประทับคำว่า &quot;ยกเลิก&quot; และเลขที่นี้จะไม่ถูกนำกลับมาใช้อีก ใบแจ้งหนี้ {receipt.invoice_doc_no} ยังคงสถานะ
              &quot;ชำระเงินแล้ว&quot; และออกใบเสร็จใหม่ได้
            </p>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="เหตุผล (ไม่บังคับ)"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
            />
            <div className="flex gap-2">
              <button onClick={() => setConfirmVoid(false)} className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">
                ไม่ใช่
              </button>
              <button
                onClick={voidReceipt}
                disabled={isBusy}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
