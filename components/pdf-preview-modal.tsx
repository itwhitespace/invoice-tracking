"use client";

import { X, ExternalLink, FileWarning } from "lucide-react";

interface PdfPreviewModalProps {
  isOpen: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function PdfPreviewModal({ isOpen, pdfUrl, title, onClose }: PdfPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-800 truncate pr-2">
            {title || "Preview เอกสาร"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="เปิดในแท็บใหม่"
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              title="ปิด"
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 overflow-hidden">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0" title="PDF Preview" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <FileWarning className="w-8 h-8" />
              <p className="text-xs font-medium">ไม่มีไฟล์ PDF ที่บันทึกไว้สำหรับรายการนี้</p>
              <p className="text-[11px] text-slate-400 max-w-xs text-center">
                ไฟล์จะแสดงที่นี่เมื่อบันทึกข้อมูลขณะเชื่อมต่อ Supabase Storage ไว้
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
