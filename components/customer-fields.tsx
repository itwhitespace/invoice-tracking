"use client";

import { CustomerSnapshot, formatTaxId, taxIdDigitCount } from "@/lib/invoices";

const FIELDS: { key: keyof CustomerSnapshot; label: string; wide?: boolean; multiline?: boolean }[] = [
  { key: "name", label: "ชื่อลูกค้า *", wide: true },
  { key: "tax_id", label: "เลขประจำตัวผู้เสียภาษี" },
  { key: "branch", label: "สำนักงานใหญ่ / สาขา" },
  { key: "address", label: "ที่อยู่", wide: true, multiline: true },
  { key: "phone", label: "เบอร์โทรบริษัท" },
  { key: "contact_name", label: "ผู้ติดต่อ" },
  { key: "contact_phone", label: "เบอร์ผู้ติดต่อ" },
  { key: "contact_email", label: "อีเมลผู้ติดต่อ" },
];

// Shared by the customer list editor and the invoice form.
export function CustomerFields({
  value,
  onChange,
  disabled,
}: {
  value: CustomerSnapshot;
  onChange: (v: CustomerSnapshot) => void;
  disabled?: boolean;
}) {
  const inputClass =
    "w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-600";
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map((f) => (
        <div key={f.key} className={`space-y-1 ${f.wide ? "col-span-2" : ""}`}>
          <label className="text-[11px] font-semibold text-slate-600">{f.label}</label>
          {f.multiline ? (
            <textarea
              rows={2}
              disabled={disabled}
              value={value[f.key] || ""}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              className={inputClass}
            />
          ) : (
            <input
              disabled={disabled}
              value={value[f.key] || ""}
              inputMode={f.key === "tax_id" ? "numeric" : undefined}
              placeholder={f.key === "tax_id" ? "0-0000-00000-00-0" : undefined}
              onChange={(e) =>
                onChange({ ...value, [f.key]: f.key === "tax_id" ? formatTaxId(e.target.value) : e.target.value })
              }
              className={inputClass}
            />
          )}
          {f.key === "tax_id" && value.tax_id && taxIdDigitCount(value.tax_id) !== 13 && (
            <p className="text-[10.5px] text-red-600">ต้องครบ 13 หลัก (ตอนนี้ {taxIdDigitCount(value.tax_id)} หลัก)</p>
          )}
        </div>
      ))}
    </div>
  );
}
