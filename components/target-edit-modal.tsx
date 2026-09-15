"use client";

import { useEffect, useState } from "react";
import { X, Save, Target as TargetIcon } from "lucide-react";

interface TargetEditModalProps {
  isOpen: boolean;
  companyLabel: string;
  departmentLabel: string;
  currentAmount: number;
  onCancel: () => void;
  onSave: (amount: number) => void;
}

// Full baht amount (not pre-divided into millions) — entering the real
// figure directly here avoids the "type millions, forget, overflow" trap;
// the table elsewhere only *displays* this compactly in millions.
export function TargetEditModal({
  isOpen,
  companyLabel,
  departmentLabel,
  currentAmount,
  onCancel,
  onSave,
}: TargetEditModalProps) {
  const [value, setValue] = useState(currentAmount);

  useEffect(() => {
    if (isOpen) setValue(currentAmount);
  }, [isOpen, currentAmount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <TargetIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">แก้ไข Target</h3>
              <p className="text-[11px] text-slate-500">
                {companyLabel} • {departmentLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          <label className="text-xs font-bold text-slate-700">Target รายปี (บาท)</label>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={value ? value.toLocaleString("en-US") : ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              setValue(digits ? parseInt(digits, 10) : 0);
            }}
            placeholder="0"
            className="w-full px-3 py-2.5 text-base font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <p className="text-[11px] text-slate-400">
            เช่น 15,557,670 บาท (ระบบจะแสดงแบบย่อเป็น 15.6 ในตาราง)
          </p>
        </div>

        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onSave(value)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
