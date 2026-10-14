"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { AppSettings } from "@/lib/types";
import { DesktopOnlyNotice } from "@/components/desktop-only-notice";
import { RequirePermission } from "@/components/require-permission";
import { Sliders, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

export default function SettingsPage() {
  return (
    <RequirePermission perm="admin">
      <SettingsContent />
    </RequirePermission>
  );
}

function SettingsContent() {
  const { settings, saveSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  return (
    <div className="relative h-full flex flex-col bg-slate-100 overflow-hidden">
      <DesktopOnlyNotice pageName="Settings" />
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <Sliders className="w-4 h-4 text-slate-700" />
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xs p-6 space-y-5 text-xs text-slate-700"
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>AI สำหรับดึงข้อมูลจาก PDF</span>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">AI Model Version</label>
              <select
                value={formData.preferredModel || "auto"}
                onChange={(e) => setFormData({ ...formData, preferredModel: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-slate-900/10 outline-none"
              >
                <option value="auto">⚡ Auto (Gemini 3.6 Flash / 3.7 Flash / Flash-Lite)</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (แนะนำ ล่าสุดและแม่นยำสูง)</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash (ล่าสุด)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">ค่านี้จำไว้เฉพาะเบราว์เซอร์นี้</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>
              API Key ของ Gemini และการเชื่อมต่อฐานข้อมูล Supabase ตั้งค่าไว้ที่ฝั่งเซิร์ฟเวอร์ (Environment Variables บน Vercel)
              ไม่ได้เก็บในเบราว์เซอร์อีกต่อไป หากต้องเปลี่ยน Key ให้แก้ที่ Vercel แล้ว Redeploy
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5 shadow-sm transition"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  บันทึกสำเร็จ!
                </>
              ) : (
                "บันทึกการตั้งค่า"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
