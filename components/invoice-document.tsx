import { Sarabun } from "next/font/google";
import {
  CustomerSnapshot,
  InvoiceItem,
  InvoiceStatus,
  IssuerCompany,
  bahtText,
  itemAmount,
  formatMoney2,
  formatThaiDate,
} from "@/lib/invoices";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export interface InvoiceDocumentData {
  doc_no: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  credit_term_days: number;
  salesman: string;
  project_name: string;
  quotation_no: string;
  ref_document: string;
  ship_to: string;
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
  issued_at: string | null;
}

const MIN_ITEM_ROWS = 10;

// "กสิกรไทย" -> "ธ.กสิกรไทย"; names already written as "ธ..." / "ธนาคาร..." are kept.
const bankLabel = (name: string) => (!name || /^ธ(\.|นาคาร)/.test(name.trim()) ? name : `ธ.${name.trim()}`);

function Label({ th, en }: { th: string; en: string }) {
  return (
    <div className="leading-none">
      <div className="text-[10.5px] font-semibold text-black">{th}</div>
      <div className="text-[7.5px] text-slate-600 mt-0.5">{en}</div>
    </div>
  );
}

function InfoRow({ th, en, value, labelWidth = "w-[72px]" }: { th: string; en: string; value: React.ReactNode; labelWidth?: string }) {
  return (
    <div className="flex items-start gap-1.5 min-h-[26px]">
      <div className={`${labelWidth} shrink-0`}>
        <Label th={th} en={en} />
      </div>
      <div className="text-[10.5px] text-black leading-snug min-w-0 break-words">
        <span className="mr-1">:</span>
        {value || ""}
      </div>
    </div>
  );
}

function SummaryRow({ th, en, value, dark }: { th: string; en: string; value: string; dark?: boolean }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 flex items-center">
        <Label th={th} en={en} />
      </div>
      <div
        className={`w-[140px] px-2.5 flex items-center justify-end text-[11px] font-semibold border border-black ${
          dark ? "bg-black text-white" : "bg-[#f1f3fb] text-black"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// One A4 page. `copyLabel` is the small box above the document number
// ("ต้นฉบับ / Original" or "สำเนา / Copy").
export function InvoiceDocument({
  data,
  logoUrl,
  bankLogoUrl,
  signatureUrl,
  copyLabel,
}: {
  data: InvoiceDocumentData;
  logoUrl: string | null;
  bankLogoUrl?: string | null;
  signatureUrl: string | null;
  copyLabel: string;
}) {
  const c = data.company;
  const cust = data.customer;
  const fillerRows = Math.max(0, MIN_ITEM_ROWS - data.items.length);
  const watermark = data.status === "void" ? "ยกเลิก / VOID" : data.status === "draft" ? "ฉบับร่าง / DRAFT" : null;

  return (
    <div
      className={`${sarabun.className} invoice-page relative bg-white text-black mx-auto`}
      style={{ width: "210mm", minHeight: "297mm", padding: "10mm 10mm 8mm" }}
    >
      {watermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span
            className={`text-[64px] font-bold tracking-widest -rotate-[30deg] ${
              data.status === "void" ? "text-red-500/25" : "text-slate-400/25"
            }`}
          >
            {watermark}
          </span>
        </div>
      )}

      {/* Header: logo + company */}
      <div className="flex items-start justify-between gap-6">
        <div className="h-[60px] max-w-[260px] flex items-center">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="max-h-[60px] max-w-[260px] object-contain" />
          ) : (
            <span className="text-[11px] text-slate-400 print:hidden">(ยังไม่มีโลโก้)</span>
          )}
        </div>
        <div className="text-right text-[10px] leading-snug min-w-0">
          <div className="text-[12px] font-semibold">
            {c?.name_th}
            {c?.branch ? ` (${c.branch})` : ""}
          </div>
          {c?.name_en && <div className="text-[10px]">{c.name_en}</div>}
          <div className="whitespace-nowrap">{c?.address}</div>
          <div>เลขที่ผู้เสียภาษี {c?.tax_id}</div>
          <div>
            {c?.phone ? `โทร: ${c.phone}` : ""}
            {c?.email ? ` | ${c.email}` : ""}
          </div>
        </div>
      </div>

      {/* Title + number */}
      <div className="flex justify-end mt-3">
        <div className="flex border border-black rounded-tl-[10px] overflow-hidden">
          <div className="w-[260px] bg-black text-white flex flex-col items-center justify-center py-2">
            <div className="text-[17px] font-bold leading-tight">Invoice</div>
            <div className="text-[11px] font-semibold leading-tight">ใบแจ้งหนี้</div>
          </div>
          <div className="w-[170px] flex flex-col">
            <div className="text-[8.5px] text-center border-b border-black py-0.5">{copyLabel}</div>
            <div className="flex-1 flex items-center justify-center text-[14px] font-semibold px-2">
              {data.doc_no || "IN-XXXXXXXXX"}
            </div>
          </div>
        </div>
      </div>

      {/* Customer + document info */}
      <div className="mt-2 grid grid-cols-[1fr_1fr] border border-black">
        <div className="p-2 space-y-1 border-r border-black">
          <InfoRow th="ชื่อลูกค้า" en="Customer Name" value={<span className="font-semibold">{cust.name}</span>} />
          <InfoRow
            th="เลขที่ผู้เสียภาษี"
            en="Tax ID"
            value={cust.tax_id ? `${cust.tax_id}${cust.branch ? ` (${cust.branch})` : ""}` : ""}
          />
          <InfoRow
            th="ที่อยู่"
            en="Address"
            value={
              <>
                {cust.address}
                {cust.phone && <div>โทร: {cust.phone}</div>}
              </>
            }
          />
        </div>
        <div className="grid grid-cols-2">
          <div className="p-2 space-y-1 border-r border-black">
            <InfoRow th="วันที่" en="Issue Date" value={formatThaiDate(data.issue_date)} labelWidth="w-[58px]" />
            <InfoRow
              th="กำหนดชำระ"
              en="Due Date"
              value={
                <>
                  {formatThaiDate(data.due_date)}
                  <div className="text-[8.5px] text-slate-600">เครดิต ({data.credit_term_days} วัน)</div>
                </>
              }
              labelWidth="w-[58px]"
            />
            <InfoRow th="ชื่อผู้ติดต่อ" en="Contact Name" value={cust.contact_name} labelWidth="w-[58px]" />
          </div>
          <div className="p-2 space-y-1">
            <InfoRow th="พนักงานขาย" en="Salesman" value={data.salesman} labelWidth="w-[62px]" />
            <InfoRow th="ใบเสนอราคา" en="Quotation No" value={data.quotation_no} labelWidth="w-[62px]" />
            <InfoRow th="เอกสารอ้างอิง" en="Ref Document" value={data.ref_document} labelWidth="w-[62px]" />
          </div>
        </div>
        <div className="p-2 border-t border-r border-black">
          <InfoRow th="ที่อยู่จัดส่ง" en="Ship To." value={data.ship_to} />
        </div>
        <div className="p-2 border-t border-black">
          <InfoRow th="ชื่อโปรเจกต์" en="Project Name" value={<span className="font-semibold">{data.project_name}</span>} labelWidth="w-[58px]" />
        </div>
      </div>

      {/* Items */}
      <table className="w-full mt-3 border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-black text-white">
            <th className="w-[40px] py-1.5 font-semibold rounded-tl-[8px]">
              เลขที่<div className="text-[7.5px] font-normal">No.</div>
            </th>
            <th className="py-1.5 font-semibold">
              รายการ<div className="text-[7.5px] font-normal">Description</div>
            </th>
            <th className="w-[62px] py-1.5 font-semibold">
              จำนวน<div className="text-[7.5px] font-normal">Quantity</div>
            </th>
            <th className="w-[88px] py-1.5 font-semibold">
              ราคา/หน่วย<div className="text-[7.5px] font-normal">Unit Price</div>
            </th>
            <th className="w-[72px] py-1.5 font-semibold">
              ส่วนลด<div className="text-[7.5px] font-normal">Discount</div>
            </th>
            <th className="w-[120px] py-1.5 font-semibold rounded-tr-[8px]">
              จำนวนเงิน (THB)<div className="text-[7.5px] font-normal">Amount</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="border-x border-black text-center py-1">{i + 1}</td>
              <td className="border-r border-black px-2 py-1">
                <div className="font-semibold">{it.description}</div>
                {it.detail && <div className="text-[9.5px] whitespace-pre-line">{it.detail}</div>}
              </td>
              <td className="border-r border-black text-center py-1">{Number(it.quantity) || 0}</td>
              <td className="border-r border-black text-right px-2 py-1">{formatMoney2(it.unit_price)}</td>
              <td className="border-r border-black text-right px-2 py-1">{formatMoney2(it.discount || 0)}</td>
              <td className="border-r border-black text-right px-2 py-1">{formatMoney2(itemAmount(it))}</td>
            </tr>
          ))}
          {Array.from({ length: fillerRows }).map((_, i) => (
            <tr key={`f${i}`} className="h-[22px]">
              <td className="border-x border-black" />
              <td className="border-r border-black" />
              <td className="border-r border-black" />
              <td className="border-r border-black" />
              <td className="border-r border-black" />
              <td className="border-r border-black" />
            </tr>
          ))}
          <tr>
            <td colSpan={6} className="border-t border-black" />
          </tr>
        </tbody>
      </table>

      {/* Amount in words + terms | totals */}
      <div className="mt-2 grid grid-cols-[1fr_300px] gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-4 bg-[#f1f3fb] px-3 py-2">
            <Label th="จำนวนเงิน" en="Amount" />
            <div className="flex-1 text-center text-[11px] font-semibold">{bahtText(data.total)}</div>
          </div>
          {data.wht_rate > 0 && (
            <div className="flex items-center gap-4 px-1">
              <Label th="หัก ณ ที่จ่าย" en="Withholding Tax" />
              <div className="text-[10.5px]">
                {data.wht_rate}% จำนวน {formatMoney2(data.wht_amount)} บาท
              </div>
            </div>
          )}
          {(c?.bank_name || c?.bank_account_no) && (
            <div className="flex items-center gap-2.5">
              {bankLogoUrl && <img src={bankLogoUrl} alt="bank" className="w-9 h-9 object-contain shrink-0" />}
              <div className="leading-tight">
                <div className="text-[10.5px]">{bankLabel(c.bank_name)}</div>
                <div className="text-[12px] font-bold">
                  {[c.bank_account_type, c.bank_account_no].filter(Boolean).join(" ")}
                </div>
                {c.bank_account_name && <div className="text-[10px]">{c.bank_account_name}</div>}
              </div>
            </div>
          )}
          <div className="text-[10px] leading-relaxed">
            <div className="text-[11.5px] font-bold">หมายเหตุและเงื่อนไข (Terms &amp; Conditions)</div>
            {data.notes && <div className="mt-1 whitespace-pre-line">{data.notes}</div>}
          </div>
        </div>
        <div className="space-y-1">
          <SummaryRow th="รวมเป็นเงิน" en="Subtotal" value={formatMoney2(data.subtotal)} />
          <SummaryRow th="หักส่วนลดพิเศษ" en="Special Discount" value={formatMoney2(data.discount)} />
          <SummaryRow th="ยอดรวมหลังหักส่วนลด" en="After Discount" value={formatMoney2(data.after_discount)} />
          {data.vat_rate > 0 && (
            <SummaryRow th={`จำนวนภาษีมูลค่าเพิ่ม ${data.vat_rate} %`} en="Value Added Tax" value={formatMoney2(data.vat_amount)} />
          )}
          <SummaryRow th="จำนวนเงินรวมทั้งสิ้น" en="Total" value={formatMoney2(data.total)} dark />
          <SummaryRow th={`หัก ณ ที่จ่าย ${data.wht_rate} %`} en="Wht" value={formatMoney2(data.wht_amount)} />
          <SummaryRow th="ยอดชำระ" en="Total" value={formatMoney2(data.net_total)} />
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-5 grid grid-cols-3 border border-black">
        <div className="h-[100px] border-r border-black flex flex-col items-center justify-end pb-2 text-[9.5px]">
          <div className="w-[160px] border-t border-dashed border-black mb-1" />
          <div className="font-semibold">ผู้รับวางบิล / Receiver Signature</div>
          <div className="mt-1">
            วันที่ / Date <span className="inline-block w-[80px] border-b border-dotted border-black" />
          </div>
        </div>
        <div className="h-[100px] border-r border-black flex items-center justify-center text-[14px] text-slate-400">
          ตราประทับบริษัท
        </div>
        <div className="h-[100px] flex flex-col items-center justify-end pb-2 text-[9.5px]">
          <div className="h-[44px] flex items-end justify-center">
            {signatureUrl && <img src={signatureUrl} alt="signature" className="max-h-[44px] max-w-[150px] object-contain" />}
          </div>
          <div className="w-[160px] border-t border-dashed border-black mb-1" />
          <div className="font-semibold">ผู้มีอำนาจลงนาม / Authorized Signature</div>
          <div className="mt-1">
            วันที่ / Date{" "}
            <span className="inline-block min-w-[80px] border-b border-dotted border-black text-center">
              {data.status !== "draft" ? formatThaiDate(data.issue_date) : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-1 bg-black text-white text-center text-[9.5px] py-1.5 rounded-b-[8px]">{c?.address}</div>
    </div>
  );
}
