"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { updatePin } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { Loader2, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";

const PIN_LENGTH = 6;

function PinBoxes({
  digits,
  onChange,
  disabled,
}: {
  digits: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[idx] = digit;
    onChange(updated);
    if (digit && idx < PIN_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {digits.map((d, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={d}
          onChange={(e) => handleDigitChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="w-full aspect-square text-center text-lg font-bold font-mono text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);

  // undefined = still checking, false = no recovery session found, true = ready
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | undefined>(undefined);
  const [newPin, setNewPin] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [confirmPin, setConfirmPin] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setHasRecoverySession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setHasRecoverySession(!!data.session));
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || isSubmitting) return;
    const pin = newPin.join("");
    const confirm = confirmPin.join("");
    setErrorMessage(null);

    if (pin.length !== PIN_LENGTH) {
      setErrorMessage("กรุณากรอก PIN ใหม่ให้ครบ 6 หลัก");
      return;
    }
    if (pin !== confirm) {
      setErrorMessage("PIN ทั้งสองช่องไม่ตรงกัน กรุณากรอกให้เหมือนกัน");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await updatePin(supabase, pin);
      if (error) {
        setErrorMessage("ตั้ง PIN ใหม่ไม่สำเร็จ: " + error);
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login"), 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icon-WR.png" alt="WR" className="w-14 h-14 rounded-2xl shadow-sm mb-3" />
          <h1 className="text-base font-bold text-slate-900">ตั้ง PIN ใหม่</h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {success ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs text-slate-600">
                ตั้ง PIN ใหม่สำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ...
              </p>
            </div>
          ) : hasRecoverySession === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : !hasRecoverySession ? (
            <div className="text-center space-y-3 py-4">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-600">
                ลิงก์นี้หมดอายุหรือใช้ไปแล้ว กรุณาขอลิงก์ตั้ง PIN ใหม่อีกครั้งจากหน้าเข้าสู่ระบบ
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">PIN ใหม่ (6 หลัก)</label>
                <PinBoxes digits={newPin} onChange={setNewPin} disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ยืนยัน PIN ใหม่</label>
                <PinBoxes digits={confirmPin} onChange={setConfirmPin} disabled={isSubmitting} />
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50/90 border border-red-300 rounded-lg text-xs text-red-900 font-medium">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                บันทึก PIN ใหม่
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
