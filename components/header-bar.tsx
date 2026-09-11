"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  Save,
  Settings,
  History,
  Loader2,
  FileCheck,
} from "lucide-react";

interface HeaderBarProps {
  onFileUpload: (file: File) => void;
  onExtractAI: () => void;
  onSaveToDatabase: () => void;
  onOpenHistory: () => void;
  isExtracting: boolean;
  isSaving: boolean;
  hasFile: boolean;
  savedCount: number;
}

export function HeaderBar({
  onFileUpload,
  onExtractAI,
  onSaveToDatabase,
  onOpenHistory,
  isExtracting,
  isSaving,
  hasFile,
  savedCount,
}: HeaderBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
          <FileCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            Upload Proposal
          </h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            PDF Document Preview, AI Data Extraction & Supabase Sync
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Upload File Button */}
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isExtracting}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 active:scale-95 rounded-md border border-slate-300/80 flex items-center gap-1.5 transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        {/* AI Extract Button */}
        <button
          onClick={onExtractAI}
          disabled={isExtracting}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-md flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>กำลังอ่านข้อมูล...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>AI Extract</span>
            </>
          )}
        </button>

        {/* Save to Database Button */}
        <button
          onClick={onSaveToDatabase}
          disabled={isSaving}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-md flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save to Database</span>
            </>
          )}
        </button>

        <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

        {/* History Drawer Button */}
        <button
          onClick={onOpenHistory}
          title="ดูประวัติเอกสารที่บันทึก"
          className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
        >
          <History className="w-4 h-4" />
          {savedCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold bg-slate-900 text-white rounded-full flex items-center justify-center font-mono">
              {savedCount}
            </span>
          )}
        </button>

        {/* Settings Page Link */}
        <Link
          href="/settings"
          title="ตั้งค่า API & Database"
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
