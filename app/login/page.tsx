"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { signInWithPin } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { Loader2, LogIn, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

const PIN_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);

  const [username, setUsername] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Already logged in? Skip straight past the login page.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const pin = digits.join("");

  const handleDigitChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[idx] = digit;
    setDigits(updated);
    setErrorMessage(null);
    if (digit && idx < PIN_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const updated = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) updated[i] = pasted[i];
    setDigits(updated);
    inputRefs.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || isSubmitting) return;
    if (pin.length !== PIN_LENGTH) {
      setErrorMessage("กรุณากรอก PIN ให้ครบ 6 หลัก");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setLockedUntil(null);
    try {
      const result = await signInWithPin(supabase, username, pin);
      if (result.success) {
        router.replace("/dashboard");
        return;
      }
      setErrorMessage(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      setLockedUntil(result.lockedUntil || null);
      setDigits(Array(PIN_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icon-WR.png" alt="WR" className="w-14 h-14 rounded-2xl shadow-sm mb-3" />
          <h1 className="text-base font-bold text-slate-900">Invoice Tracking Program</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">เข้าสู่ระบบด้วยชื่อผู้ใช้และ PIN</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {!supabase ? (
            <div className="text-center space-y-3 py-4">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-600">
                ยังไม่ได้ตั้งค่า Supabase ในเบราว์เซอร์นี้ กรุณาตั้งค่าก่อนเข้าสู่ระบบ
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                ไปหน้า Settings
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="เช่น somchai"
                  className="w-full px-3 py-2 text-sm font-medium text-slate-800 bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">PIN (6 หลัก)</label>
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
                      value={d}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="w-full aspect-square text-center text-lg font-bold font-mono text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50/90 border border-red-300 rounded-lg text-xs text-red-900 font-medium">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p>{errorMessage}</p>
                    {lockedUntil && (
                      <p className="text-[11px] text-red-700 mt-0.5">
                        ปลดล็อกอัตโนมัติเมื่อ {new Date(lockedUntil).toLocaleString("th-TH")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                เข้าสู่ระบบ
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
