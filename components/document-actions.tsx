"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, Loader2, Printer } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { signedAssetUrl } from "@/lib/invoices";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoice-document";
import { InvoicePrintRoot } from "@/components/invoice-print-root";

// Builds a PDF of the document in the browser and saves it through the
// browser's "Save As" window (Chrome / Edge), or as a normal download where
// that window isn't available.
export function DownloadPdfButton({
  data,
  signaturePath,
}: {
  data: InvoiceDocumentData;
  signaturePath: string | null | undefined;
}) {
  const supabase = getSupabaseClient();
  const holderRef = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState<null | { logo: string | null; sig: string | null }>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setError("");
    const fileName = `${data.doc_no || "document"}.pdf`;

    // The Save As window must open straight from the click, before the slow part.
    type SaveHandle = { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> };
    let handle: SaveHandle | null = null;
    const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<SaveHandle> }).showSaveFilePicker;
    if (picker) {
      try {
        handle = await picker({
          suggestedName: fileName,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        handle = null;
      }
    }

    setIsBusy(true);
    try {
      const [logo, sig] = await Promise.all([
        signedAssetUrl(supabase, data.company?.logo_path),
        signedAssetUrl(supabase, signaturePath),
      ]);
      setRender({ logo, sig });
      const page = await waitForPage(holderRef);
      const blob = await buildPdf(page);
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (e) {
      console.error(e);
      setError("สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setRender(null);
      setIsBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={download}
        disabled={isBusy}
        title={error || "บันทึกเอกสารเป็นไฟล์ PDF"}
        className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-full flex items-center gap-1.5"
      >
        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {isBusy ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {render &&
        createPortal(
          <div ref={holderRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
            <InvoiceDocument data={data} logoUrl={render.logo} signatureUrl={render.sig} copyLabel="ต้นฉบับ / Original" forFile />
          </div>,
          document.body
        )}
    </>
  );
}

// Waits until the off-screen document is mounted and its images and fonts are loaded.
async function waitForPage(holderRef: React.RefObject<HTMLDivElement | null>): Promise<HTMLElement> {
  for (let i = 0; i < 100; i++) {
    const page = holderRef.current?.querySelector<HTMLElement>(".invoice-page");
    if (page) {
      await Promise.all(
        Array.from(page.querySelectorAll("img")).map((img) =>
          img.complete
            ? null
            : new Promise((res) => {
                img.addEventListener("load", res, { once: true });
                img.addEventListener("error", res, { once: true });
              })
        )
      );
      await document.fonts.ready;
      return page;
    }
    await new Promise((r) => requestAnimationFrame(r));
  }
  throw new Error("document did not render");
}

// One A4 page per 297mm of document height.
async function buildPdf(page: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const canvas = await toCanvas(page, { pixelRatio: 2, backgroundColor: "#ffffff" });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const pageH = 297;
  const pagePx = Math.floor((canvas.width * pageH) / pageW);

  for (let y = 0, n = 0; y < canvas.height - 2; y += pagePx, n++) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pagePx, canvas.height - y);
    slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (n > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, (slice.height * pageW) / canvas.width);
  }
  return pdf.output("blob");
}

// "พิมพ์" prints original + copy straight away; the arrow offers original only.
// The print-only copy of the document is mounted just while printing, so a
// page can hold more than one of these buttons without printing twice.
export function PrintDocumentButton({
  data,
  signaturePath,
}: {
  data: InvoiceDocumentData;
  signaturePath: string | null | undefined;
}) {
  const supabase = getSupabaseClient();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [mode, setMode] = useState<null | "copy" | "original">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsReady(false);
    Promise.all([signedAssetUrl(supabase, data.company?.logo_path), signedAssetUrl(supabase, signaturePath)]).then(
      ([logo, sig]) => {
        setLogoUrl(logo);
        setSignatureUrl(sig);
        setIsReady(true);
      }
    );
  }, [supabase, data.company?.logo_path, signaturePath]);

  useEffect(() => {
    if (!mode) return;
    const done = () => setMode(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [mode]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative flex">
      <button
        type="button"
        onClick={() => setMode("copy")}
        disabled={!isReady}
        title="พิมพ์ต้นฉบับ + สำเนา — เลือก Save as PDF เพื่อได้ไฟล์ PDF"
        className="pl-4 pr-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-l-full flex items-center gap-1.5"
      >
        <Printer className="w-3.5 h-3.5" />
        พิมพ์
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={!isReady}
        aria-label="ตัวเลือกการพิมพ์"
        className="px-2 py-1.5 text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-r-full border-l border-orange-400"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-[75] w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs">
          <button
            onClick={() => {
              setMenuOpen(false);
              setMode("copy");
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50"
          >
            ต้นฉบับ + สำเนา
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              setMode("original");
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50"
          >
            เฉพาะต้นฉบับ
          </button>
        </div>
      )}
      {mode && <InvoicePrintRoot data={data} logoUrl={logoUrl} signatureUrl={signatureUrl} includeCopy={mode === "copy"} />}
    </div>
  );
}
