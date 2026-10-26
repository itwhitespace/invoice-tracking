"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Invoice, signedAssetUrl } from "@/lib/invoices";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoicePrintRoot } from "@/components/invoice-print-root";

const A4_WIDTH_PX = 794;

// Full-size preview of an issued (or voided) invoice with the print buttons.
// Uses the company and signature captured when the invoice was issued.
export function InvoicePreviewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const supabase = getSupabaseClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bankLogoUrl, setBankLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [withCopy, setWithCopy] = useState(true);

  useEffect(() => {
    Promise.all([
      signedAssetUrl(supabase, invoice.company?.logo_path),
      signedAssetUrl(supabase, invoice.company?.bank_logo_path),
      signedAssetUrl(supabase, invoice.signature_path),
    ]).then(([logo, bankLogo, sig]) => {
      setLogoUrl(logo);
      setBankLogoUrl(bankLogo);
      setSignatureUrl(sig);
      setIsLoadingImages(false);
    });
  }, [supabase, invoice.company?.logo_path, invoice.company?.bank_logo_path, invoice.signature_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const print = (copy: boolean) => {
    setWithCopy(copy);
    setTimeout(() => window.print(), 100);
  };

  const scale = 0.85;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/70 backdrop-blur-xs">
      <div className="h-14 px-5 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-slate-900 font-mono">{invoice.doc_no}</span>
        {invoice.status === "void" && (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-red-100 text-red-800 border-red-300">ยกเลิก</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isLoadingImages && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          <button
            onClick={() => print(true)}
            disabled={isLoadingImages}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg flex items-center gap-1.5"
            title="ต้นฉบับ + สำเนา — เลือกปลายทางเป็น Save as PDF เพื่อได้ไฟล์ PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์ / PDF (ต้นฉบับ + สำเนา)
          </button>
          <button
            onClick={() => print(false)}
            disabled={isLoadingImages}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            เฉพาะต้นฉบับ
          </button>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="ปิด">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        <div style={{ width: A4_WIDTH_PX * scale, height: A4_WIDTH_PX * Math.SQRT2 * scale }} className="mx-auto shadow-2xl overflow-hidden">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <InvoiceDocument data={invoice} logoUrl={logoUrl} bankLogoUrl={bankLogoUrl} signatureUrl={signatureUrl} copyLabel="ต้นฉบับ / Original" />
          </div>
        </div>
      </div>
      <InvoicePrintRoot data={invoice} logoUrl={logoUrl} bankLogoUrl={bankLogoUrl} signatureUrl={signatureUrl} includeCopy={withCopy} />
    </div>
  );
}
