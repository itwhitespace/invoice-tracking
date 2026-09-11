"use client";

import { CheckCircle2, X } from "lucide-react";

interface SaveSuccessModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function SaveSuccessModal({ isOpen, message, onConfirm, onClose }: SaveSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-8 text-center relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          title="ปิด"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-1.5">บันทึกสำเร็จ!</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-5 whitespace-pre-line text-left">{message}</p>

        <p className="text-xs text-slate-700 font-medium mb-3">
          ต้องการไปที่หน้า Proposal Preview เพื่อดูรายการที่บันทึกไว้หรือไม่?
        </p>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
          >
            ไม่, อยู่หน้านี้ต่อ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm transition"
          >
            ใช่, ไปดูเลย
          </button>
        </div>
      </div>
    </div>
  );
}
