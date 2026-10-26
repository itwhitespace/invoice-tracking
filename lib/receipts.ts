import type { InvoiceDocumentData } from "@/components/invoice-document";
import type { Receipt } from "./invoices";

// A receipt prints with the same A4 layout as the invoice it came from.
export function receiptToDocument(r: Receipt): InvoiceDocumentData & { signature_path: string | null } {
  return {
    ...r.data,
    kind: "receipt",
    doc_no: r.doc_no,
    status: r.status,
    issue_date: r.issue_date,
    invoice_doc_no: r.invoice_doc_no,
    paid_at: r.paid_at,
    payment_method: r.payment_method,
    payment_note: r.payment_note,
    issued_at: r.issued_at,
    signature_path: r.signature_path,
  };
}
