"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Loader2, CheckCircle2, Upload, Plus, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  EMPTY_ISSUER,
  IssuerCompany,
  formatTaxId,
  issuerDisplayName,
  signedAssetUrl,
  taxIdDigitCount,
  uploadInvoiceAsset,
} from "@/lib/invoices";

const FIELDS: { key: keyof IssuerCompany; label: string; multiline?: boolean; wide?: boolean }[] = [
  { key: "name_th", label: "ชื่อบริษัท (ไทย)", wide: true },
  { key: "name_en", label: "ชื่อบริษัท (อังกฤษ)", wide: true },
  { key: "address", label: "ที่อยู่", multiline: true, wide: true },
  { key: "tax_id", label: "เลขประจำตัวผู้เสียภาษี" },
  { key: "branch", label: "สำนักงานใหญ่ / สาขา" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "email", label: "อีเมล" },
];

const BANK_FIELDS: { key: keyof IssuerCompany; label: string; wide?: boolean; placeholder?: string }[] = [
  { key: "bank_name", label: "ธนาคาร", placeholder: "เช่น กสิกรไทย" },
  { key: "bank_account_type", label: "ประเภทบัญชี", placeholder: "เช่น ออมทรัพย์" },
  { key: "bank_account_no", label: "เลขที่บัญชี" },
  { key: "bank_branch", label: "สาขาธนาคาร (ไม่แสดงบนเอกสาร)" },
  { key: "bank_account_name", label: "ชื่อบัญชี", wide: true },
];

export default function IssuerCompaniesPage() {
  const supabase = getSupabaseClient();
  const [companies, setCompanies] = useState<IssuerCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("issuer_companies").select("*").order("created_at");
    if (error) setLoadError(error.message);
    else setCompanies((data as IssuerCompany[]) || []);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const addCompany = async () => {
    if (!supabase) return;
    setIsAdding(true);
    const { error } = await supabase.from("issuer_companies").insert({ company_key: crypto.randomUUID(), ...EMPTY_ISSUER });
    setIsAdding(false);
    if (error) setLoadError("เพิ่มบริษัทไม่สำเร็จ: " + error.message);
    else await load();
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mb-4 flex items-start justify-between gap-4">
        <p className="text-[11.5px] text-slate-500 leading-relaxed">
          บริษัทผู้ออกใบแจ้งหนี้ ใช้เป็นหัวเอกสารและข้อมูลบัญชีธนาคาร — แยกจากบริษัทในหน้า Roadmap และ Dashboard
          ใบที่ออกไปแล้วเก็บข้อมูล ณ วันที่ออกไว้ แก้ที่นี่มีผลกับใบที่ออกหลังจากนี้เท่านั้น
        </p>
        <button
          onClick={addCompany}
          disabled={isAdding}
          className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-60"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          เพิ่มบริษัท
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      ) : loadError ? (
        <div className="text-xs text-red-700">
          โหลดข้อมูลไม่สำเร็จ: {loadError}
          <p className="text-slate-500 mt-1">ถ้าเพิ่งเปิดใช้เมนูนี้ ให้รันไฟล์ supabase/invoices-setup.sql ก่อน</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="max-w-5xl py-16 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
          ยังไม่มีบริษัท — กด &quot;เพิ่มบริษัท&quot; เพื่อเริ่ม
        </div>
      ) : (
        <div className="max-w-5xl grid grid-cols-1 xl:grid-cols-2 gap-5">
          {companies.map((c) => (
            <CompanyCard key={c.company_key} initial={c} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ initial, onDeleted }: { initial: IssuerCompany; onDeleted: () => void }) {
  const supabase = getSupabaseClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async () => {
    if (!supabase) return;
    const { error: delErr } = await supabase.from("issuer_companies").delete().eq("company_key", initial.company_key);
    if (delErr) {
      setConfirmDelete(false);
      setError(
        delErr.code === "23503"
          ? "ลบไม่ได้ เพราะมีใบแจ้งหนี้ที่ออกในนามบริษัทนี้แล้ว"
          : "ลบไม่สำเร็จ: " + delErr.message
      );
      return;
    }
    onDeleted();
  };
  const [draft, setDraft] = useState<IssuerCompany>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof IssuerCompany, value: string) => {
    setDraft({ ...draft, [key]: key === "tax_id" ? formatTaxId(value) : value });
  };

  // `patch` is used for the logo upload, which saves on its own without the popup.
  const save = async (patch?: Partial<IssuerCompany>) => {
    if (!supabase) return;
    if (!patch) {
      if (!draft.name_th.trim()) {
        setError("กรุณากรอกชื่อบริษัท (ไทย)");
        return;
      }
      if (taxIdDigitCount(draft.tax_id) !== 13) {
        setError("เลขประจำตัวผู้เสียภาษีต้องครบ 13 หลัก");
        return;
      }
    }
    setIsSaving(true);
    setError("");
    const { company_key, created_at: _c, ...rest } = { ...draft, ...patch } as IssuerCompany & { updated_at?: string };
    const { error: saveError } = await supabase.from("issuer_companies").update(rest).eq("company_key", company_key);
    setIsSaving(false);
    if (saveError) setError("บันทึกไม่สำเร็จ: " + saveError.message);
    else if (!patch) setShowSaved(true);
  };

  // Uploads (or removes, with file = null) the company or bank logo and saves it right away.
  const setImage = async (field: "logo_path" | "bank_logo_path", file: File | null): Promise<boolean> => {
    if (!supabase) return false;
    setError("");
    let path: string | null = null;
    if (file) {
      if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
        setError("รูปต้องเป็น PNG, JPG หรือ SVG ขนาดไม่เกิน 2 MB");
        return false;
      }
      const suffix = field === "bank_logo_path" ? "_bank" : "";
      const res = await uploadInvoiceAsset(supabase, "logos", draft.company_key + suffix, file);
      if (res.error || !res.path) {
        setError("อัปโหลดรูปไม่สำเร็จ: " + res.error);
        return false;
      }
      path = res.path;
    }
    setDraft((d) => ({ ...d, [field]: path }));
    await save({ [field]: path });
    return true;
  };

  const inputClass =
    "w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500";

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Building2 className="w-4 h-4 text-indigo-600" />
        <span className="flex-1 truncate">{issuerDisplayName(draft)}</span>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 text-[11px] font-normal">
            <span className="text-red-700">ลบบริษัทนี้?</span>
            <button onClick={remove} className="px-2 py-0.5 font-semibold text-white bg-red-600 rounded">ลบ</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 font-semibold text-slate-700 bg-slate-100 rounded">
              ไม่ใช่
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} title="ลบบริษัทนี้" className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <ImageSlot
        label="โลโก้บริษัท"
        path={draft.logo_path}
        boxClass="w-44 h-16"
        onPick={(f) => setImage("logo_path", f)}
      />

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={`space-y-1 ${f.wide ? "col-span-2" : ""}`}>
            <label className="text-[11px] font-semibold text-slate-600">{f.label}</label>
            {f.multiline ? (
              <textarea
                rows={2}
                value={(draft[f.key] as string) || ""}
                onChange={(e) => update(f.key, e.target.value)}
                className={inputClass}
              />
            ) : (
              <input
                value={(draft[f.key] as string) || ""}
                onChange={(e) => update(f.key, e.target.value)}
                inputMode={f.key === "tax_id" ? "numeric" : undefined}
                placeholder={f.key === "tax_id" ? "0-0000-00000-00-0" : undefined}
                className={inputClass}
              />
            )}
            {f.key === "tax_id" && draft.tax_id && taxIdDigitCount(draft.tax_id) !== 13 && (
              <p className="text-[10.5px] text-red-600">ต้องครบ 13 หลัก (ตอนนี้ {taxIdDigitCount(draft.tax_id)} หลัก)</p>
            )}
          </div>
        ))}
      </div>

      <div className="pt-1 border-t border-slate-100 space-y-3">
        <div className="text-xs font-bold text-slate-900 pt-2">บัญชีรับเงิน</div>
        <ImageSlot
          label="โลโก้ธนาคาร (ไม่บังคับ — ถ้าไม่มีจะไม่แสดงรูปบนเอกสาร)"
          path={draft.bank_logo_path || null}
          boxClass="w-16 h-16"
          onPick={(f) => setImage("bank_logo_path", f)}
          onRemove={() => setImage("bank_logo_path", null)}
        />
        <div className="grid grid-cols-2 gap-3">
          {BANK_FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1 ${f.wide ? "col-span-2" : ""}`}>
              <label className="text-[11px] font-semibold text-slate-600">{f.label}</label>
              <input
                value={(draft[f.key] as string) || ""}
                placeholder={f.placeholder}
                onChange={(e) => update(f.key, e.target.value)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => save()}
          disabled={isSaving}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg flex items-center gap-1.5"
        >
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          บันทึกข้อมูลบริษัท
        </button>
      </div>

      {showSaved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">บันทึกข้อมูลบริษัทเรียบร้อยแล้ว</h3>
              <p className="text-xs text-slate-500 mt-1">{issuerDisplayName(draft)}</p>
            </div>
            <button
              autoFocus
              onClick={() => setShowSaved(false)}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageSlot({
  label,
  path,
  boxClass,
  onPick,
  onRemove,
}: {
  label: string;
  path: string | null;
  boxClass: string;
  onPick: (file: File) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
}) {
  const supabase = getSupabaseClient();
  const ref = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    signedAssetUrl(supabase, path).then(setUrl);
  }, [supabase, path]);

  const run = async (fn: () => Promise<boolean>) => {
    setIsBusy(true);
    await fn();
    setIsBusy(false);
  };

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-600">{label}</label>
      <div className="flex items-center gap-3">
        <div className={`${boxClass} border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50`}>
          {url ? (
            <img src={url} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[10.5px] text-slate-400">ไม่มีรูป</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={isBusy}
          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {path ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        </button>
        {path && onRemove && (
          <button
            type="button"
            onClick={() => run(onRemove)}
            disabled={isBusy}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-md flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            เอาออก
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) run(() => onPick(f));
          }}
        />
      </div>
    </div>
  );
}
