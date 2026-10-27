"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, KeyRound, Lock, ArrowLeft } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { SetPasswordForm } from "@/components/set-password-form";

const RESEND_COOLDOWN_SECONDS = 60;

type Step = "password" | "otp-email" | "otp-code" | "set-password";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { session, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Signing in with an email code creates the session before the "set a
  // password" step — don't bounce to the dashboard in between.
  const inCodeFlow = useRef(false);

  useEffect(() => {
    if (!isLoading && session && !inCodeFlow.current) router.replace("/dashboard");
  }, [isLoading, session, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const codeLooksValid = /^\d{6,10}$/.test(code.trim());

  const goTo = (next: Step) => {
    setError("");
    setStep(next);
  };

  const signInWithPassword = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setIsBusy(false);
    if (signInError) {
      setError(
        signInError.status === 429
          ? "ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่เคยตั้งรหัสผ่าน ให้กด \"เข้าใช้งานครั้งแรก / ลืมรหัสผ่าน\" ด้านล่าง"
      );
      return;
    }
    router.replace("/dashboard");
  };

  const sendCode = async () => {
    if (!supabase) {
      setError("ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      const { data: invited, error: inviteError } = await supabase.rpc("app_is_invited", { p_email: normalizedEmail });
      if (inviteError) {
        setError("ตรวจสอบรายชื่อผู้ใช้ไม่สำเร็จ: " + inviteError.message);
        return;
      }
      if (!invited) {
        setError("อีเมลนี้ยังไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบให้เพิ่มรายชื่อ");
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (otpError) {
        setError(
          otpError.status === 429
            ? "ขอรหัสได้ครั้งละประมาณ 1 นาที กรุณารอสักครู่แล้วกดใหม่"
            : "ส่งรหัสไม่สำเร็จ: " + otpError.message
        );
        return;
      }

      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      goTo("otp-code");
    } finally {
      setIsBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setError("");
    inCodeFlow.current = true;
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code.trim(),
      type: "email",
    });
    setIsBusy(false);
    if (verifyError) {
      inCodeFlow.current = false;
      setError("รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาลองใหม่ หรือกดขอรหัสใหม่");
      return;
    }
    goTo("set-password");
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500";
  const primaryButton =
    "w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-1.5 transition";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-7 space-y-5">
        <div className="flex items-center gap-2.5">
          <img src="/icon-WR.png" alt="WR" className="w-9 h-9 rounded-lg object-cover shadow-xs" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Program tracking</h1>
            <p className="text-[11px] text-slate-500">
              {step === "password"
                ? "เข้าสู่ระบบ"
                : step === "set-password"
                  ? "ตั้งรหัสผ่าน"
                  : "เข้าใช้งานครั้งแรก / ลืมรหัสผ่าน"}
            </p>
          </div>
        </div>

        {step === "password" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (emailLooksValid && password && !isBusy) signInWithPassword();
            }}
          >
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              อีเมล
            </label>
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              รหัสผ่าน
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={!emailLooksValid || !password || isBusy} className={primaryButton}>
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => goTo("otp-email")}
              className="w-full text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
              เข้าใช้งานครั้งแรก / ลืมรหัสผ่าน
            </button>
          </form>
        )}

        {step === "otp-email" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (emailLooksValid && !isBusy && cooldown <= 0) sendCode();
            }}
          >
            <p className="text-xs text-slate-600 leading-relaxed">
              ระบบจะส่งรหัส 6 หลักไปที่อีเมลของคุณ เพื่อยืนยันตัวตนแล้วตั้งรหัสผ่านใหม่
              ใช้ได้เฉพาะอีเมลที่ผู้ดูแลระบบเพิ่มไว้แล้วเท่านั้น
            </p>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              อีเมล
            </label>
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
            <button type="submit" disabled={!emailLooksValid || isBusy || cooldown > 0} className={primaryButton}>
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {cooldown > 0 ? `ขอรหัสได้อีกครั้งใน ${cooldown} วินาที` : "ส่งรหัสไปที่อีเมล"}
            </button>
            <button
              type="button"
              onClick={() => goTo("password")}
              className="text-[11.5px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              กลับไปเข้าสู่ระบบด้วยรหัสผ่าน
            </button>
          </form>
        )}

        {step === "otp-code" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeLooksValid && !isBusy) verifyCode();
            }}
          >
            <p className="text-xs text-slate-600 leading-relaxed">
              ส่งรหัสไปที่ <span className="font-semibold text-slate-900">{normalizedEmail}</span> แล้ว
              ถ้าไม่เจอในกล่องจดหมาย ลองดูในโฟลเดอร์สแปม
            </p>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              รหัสจากอีเมล
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-3 py-2.5 text-lg font-mono tracking-[0.4em] text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
            />
            <button type="submit" disabled={!codeLooksValid || isBusy} className={primaryButton}>
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              ยืนยันรหัส
            </button>
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => goTo("otp-email")}
                className="text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                เปลี่ยนอีเมล
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown > 0 || isBusy}
                className="text-indigo-600 hover:text-indigo-800 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `ขอรหัสใหม่ได้ใน ${cooldown} วินาที` : "ขอรหัสใหม่"}
              </button>
            </div>
          </form>
        )}

        {step === "set-password" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              ยืนยันอีเมลเรียบร้อยแล้ว ตั้งรหัสผ่านสำหรับเข้าสู่ระบบครั้งต่อไป (อย่างน้อย 8 ตัวอักษร)
            </p>
            <SetPasswordForm submitLabel="บันทึกรหัสผ่านและเข้าสู่ระบบ" onDone={() => router.replace("/dashboard")} />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-red-800 leading-relaxed">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
