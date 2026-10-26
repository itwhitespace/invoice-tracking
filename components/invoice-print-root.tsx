"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoice-document";

// Mounted straight under <body> so printing isn't clipped by the app's
// scroll containers; hidden on screen by the #invoice-print-root CSS rule.
export function InvoicePrintRoot({
  data,
  logoUrl,
  signatureUrl,
  includeCopy,
}: {
  data: InvoiceDocumentData;
  logoUrl: string | null;
  signatureUrl: string | null;
  includeCopy: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div id="invoice-print-root">
      <InvoiceDocument data={data} logoUrl={logoUrl} signatureUrl={signatureUrl} copyLabel="ต้นฉบับ / Original" />
      {includeCopy && (
        <InvoiceDocument data={data} logoUrl={logoUrl} signatureUrl={signatureUrl} copyLabel="สำเนา / Copy" />
      )}
    </div>,
    document.body
  );
}
