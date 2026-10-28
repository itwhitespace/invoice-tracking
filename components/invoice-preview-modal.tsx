"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { signedAssetUrl } from "@/lib/invoices";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoice-document";
import { DownloadPdfButton, PrintDocumentButton } from "@/components/document-actions";

const A4_WIDTH_PX = 794;

// Full-size preview of an issued (or voided) invoice or receipt with the
// print buttons. Uses the company and signature captured when it was issued.
export function InvoicePreviewModal({
  invoice,
  onClose,
  historyLabel,
}: {
  invoice: InvoiceDocumentData & { signature_path?: string | null };
  onClose: () => void;
  // Set when showing an earlier version from the edit history — labels it
  // and hides the print / PDF buttons so the old version isn't sent out.
  historyLabel?: string;
}) {
  const supabase = getSupabaseClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  useEffect(() => {
    Promise.all([
      signedAssetUrl(supabase, invoice.company?.logo_path),
      signedAssetUrl(supabase, invoice.signature_path),
    ]).then(([logo, sig]) => {
      setLogoUrl(logo);
      setSignatureUrl(sig);
      setIsLoadingImages(false);
    });
  }, [supabase, invoice.company?.logo_path, invoice.signature_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scale = 0.85;

  // Portalled so it never inherits styles from wherever it was opened (e.g. a table row).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/70 backdrop-blur-xs">
      <div className="h-14 px-5 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-slate-900 font-mono">{invoice.doc_no}</span>
        {invoice.status === "void" && (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-red-100 text-red-800 border-red-300">ยกเลิก</span>
        )}
        {historyLabel && (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-amber-100 text-amber-900 border-amber-300">
            {historyLabel}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isLoadingImages && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {!historyLabel && (
            <>
              <DownloadPdfButton data={invoice} signaturePath={invoice.signature_path} />
              <PrintDocumentButton data={invoice} signaturePath={invoice.signature_path} />
            </>
          )}
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="ปิด">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        <div style={{ width: A4_WIDTH_PX * scale, height: A4_WIDTH_PX * Math.SQRT2 * scale }} className="mx-auto shadow-2xl overflow-hidden">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <InvoiceDocument data={invoice} logoUrl={logoUrl} signatureUrl={signatureUrl} copyLabel="ต้นฉบับ / Original" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
