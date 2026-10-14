"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

export const MIN_PASSWORD_LENGTH = 8;

// Shared by the login page (after an email code), the first-login prompt,
// and "change password" from the sidebar.
export function SetPasswordForm({
  submitLabel,
  onDone,
  onCancel,
}: {
  submitLabel: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && password === confirm && !isBusy;

  const submit = async () => {
    if (!supabase || !canSubmit) return;
    setIsBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    setIsBusy(false);
    if (updateError) {
      const msg = updateError.message || "";
      setError(
        /reauthentic/i.test(msg)
          ? "เพื่อความปลอดภัย กรุณาออกจากระบบ แล้วเข้าใหม่ด้วย \"ลืมรหัสผ่าน\" เพื่อตั้งรหัสผ่านใหม่"
          : /same|different from the old/i.test(msg)
            ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"
            : /weak|short|characters/i.test(msg)
              ? "รหัสผ่านไม่ผ่านเงื่อนไขความปลอดภัย กรุณาตั้งให้ยาวขึ้นหรือซับซ้อนขึ้น"
              : "ตั้งรหัสผ่านไม่สำเร็จ: " + msg
      );
      return;
    }
    onDone();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        รหัสผ่านใหม่
      </label>
      <input
        type="password"
        autoFocus
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
      />
      {tooShort && <p className="text-[11px] text-amber-700">อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร</p>}
      <label className="text-xs font-semibold text-slate-700">ยืนยันรหัสผ่านใหม่</label>
      <input
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
      />
      {mismatch && <p className="text-[11px] text-red-600">รหัสผ่านทั้งสองช่องไม่ตรงกัน</p>}
      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-1.5 transition"
        >
          {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-red-800 leading-relaxed">{error}</div>
      )}
    </form>
  );
}
