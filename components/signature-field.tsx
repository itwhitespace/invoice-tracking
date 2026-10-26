"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PenLine, Trash2, Upload } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { signedAssetUrl, uploadInvoiceAsset } from "@/lib/invoices";

const MAX_BYTES = 1024 * 1024;

// Admin-only: the signature image printed on invoices this user issues.
// Saves straight away (separately from the permission form's Save button).
export function SignatureField({
  email,
  initialPath,
  onChanged,
}: {
  email: string;
  initialPath: string | null | undefined;
  onChanged?: (path: string | null) => void;
}) {
  const supabase = getSupabaseClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(initialPath || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    signedAssetUrl(supabase, path).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, path]);

  const savePath = async (newPath: string | null) => {
    if (!supabase) return false;
    const { error: updateError } = await supabase.from("app_users").update({ signature_path: newPath }).eq("email", email);
    if (updateError) {
      setError("บันทึกลายเซ็นไม่สำเร็จ: " + updateError.message);
      return false;
    }
    setPath(newPath);
    onChanged?.(newPath);
    return true;
  };

  const handleFile = async (file: File) => {
    if (!supabase) return;
    setError("");
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("รองรับเฉพาะไฟล์ PNG หรือ JPG");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("ไฟล์ใหญ่เกิน 1 MB");
      return;
    }
    setIsBusy(true);
    const { path: uploaded, error: uploadError } = await uploadInvoiceAsset(supabase, "signatures", email, file);
    if (uploadError || !uploaded) {
      setError("อัปโหลดไม่สำเร็จ: " + uploadError);
    } else {
      await savePath(uploaded);
    }
    setIsBusy(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
        <PenLine className="w-3.5 h-3.5" />
        ลายเซ็นสำหรับใบแจ้งหนี้
      </label>
      <div className="flex items-center gap-3">
        <div className="w-40 h-16 border border-dashed border-slate-300 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="ลายเซ็น" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[10.5px] text-slate-400">ยังไม่มีลายเซ็น</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {path ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          </button>
          {path && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => savePath(null)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-md flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              เอาออก
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleFile(f);
          }}
        />
      </div>
      <p className="text-[10.5px] text-slate-500">
        แนะนำ PNG พื้นหลังโปร่งใส ไม่เกิน 1 MB — ใช้กับใบแจ้งหนี้ที่ผู้ใช้นี้กดออกหลังจากนี้ (ใบที่ออกไปแล้วไม่เปลี่ยน)
      </p>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
