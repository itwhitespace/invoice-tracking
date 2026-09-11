"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { AppSettings } from "@/lib/types";
import { isValidSupabaseUrl } from "@/lib/supabase";
import { Key, Database, Sliders, CheckCircle2, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const isUrlValid = isValidSupabaseUrl(formData.supabaseUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUrlValid) return;
    saveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <Sliders className="w-4 h-4 text-slate-700" />
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">
          API & Database Settings
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xs p-6 space-y-5 text-xs text-slate-700"
        >
          {/* Gemini AI Settings */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Google Gemini AI API</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              ใช้สำหรับสกัดข้อมูลเอกสาร PDF ด้วย Gemini 1.5 Flash + Structured Outputs
            </p>
            <input
              type="password"
              value={formData.geminiApiKey}
              onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 outline-none"
            />

            <div className="pt-1">
              <label className="text-[11px] font-medium text-slate-600 block mb-1">AI Model Version</label>
              <select
                value={formData.preferredModel || "auto"}
                onChange={(e) => setFormData({ ...formData, preferredModel: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-slate-900/10 outline-none"
              >
                <option value="auto">⚡ Auto (Gemini 3.6 Flash / 3.7 Flash)</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (แนะนำ ล่าสุดและแม่นยำสูง)</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash (ล่าสุด)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Supabase Settings */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Supabase Database & Storage</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              ใช้สำหรับบันทึกข้อมูลและเก็บไฟล์ PDF ลง Supabase Storage
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600">Supabase Project URL</label>
                <input
                  type="text"
                  value={formData.supabaseUrl}
                  onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  className={`w-full px-3 py-2 border rounded-md font-mono text-xs focus:ring-2 outline-none mt-1 ${
                    isUrlValid
                      ? "border-slate-300 focus:ring-slate-900/10 focus:border-slate-500"
                      : "border-red-400 focus:ring-red-500/10 focus:border-red-500"
                  }`}
                />
                {!isUrlValid && (
                  <p className="text-[11px] text-red-600 mt-1">
                    URL ไม่ถูกต้อง — ต้องขึ้นต้นด้วย https:// เช่น https://xxxxxxxxxxxx.supabase.co
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600">Supabase Anon Key</label>
                <input
                  type="password"
                  value={formData.supabaseAnonKey}
                  onChange={(e) => setFormData({ ...formData, supabaseAnonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600">Storage Bucket Name</label>
                <input
                  type="text"
                  value={formData.supabaseBucket}
                  onChange={(e) => setFormData({ ...formData, supabaseBucket: e.target.value })}
                  placeholder="pdf-documents"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-xs focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 outline-none mt-1"
                />
              </div>
            </div>
          </div>

          {/* Info Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-slate-600 text-[11px]">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>
              หากยังไม่ได้ระบุ API Key ระบบจะใช้ <strong>AI Demo Preset</strong> และเก็บข้อมูลใน <strong>Local Storage</strong> ให้คุณสามารถทดสอบฟังก์ชันทั้งหมดได้ทันที
            </p>
          </div>

          {/* Save Action */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={!isUrlValid}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1.5 shadow-sm transition"
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
