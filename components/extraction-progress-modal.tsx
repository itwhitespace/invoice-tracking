"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileText, Cpu, CheckCircle2, Clock, X } from "lucide-react";

interface ExtractionProgressModalProps {
  isOpen: boolean;
  isCompleted?: boolean;
  fileName?: string;
  onCancel?: () => void;
}

const STEPS = [
  { label: "กำลังเปิดและประมวลผลไฟล์ PDF", icon: FileText, threshold: 25 },
  { label: "เชื่อมต่อ Google Gemini AI Engine", icon: Cpu, threshold: 50 },
  { label: "วิเคราะห์ Project Brief & ตารางงวดงาน", icon: Sparkles, threshold: 75 },
  { label: "แปลงโครงสร้างข้อมูลเป็น JSON Schema", icon: CheckCircle2, threshold: 95 },
];

export function ExtractionProgressModal({
  isOpen,
  isCompleted,
  fileName,
  onCancel,
}: ExtractionProgressModalProps) {
  const [progress, setProgress] = useState(10);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(10);
      setElapsed(0);
      return;
    }

    // Timer for elapsed seconds
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Continuous dynamic progression
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 35) return prev + 3;
        if (prev < 65) return prev + 2;
        if (prev < 85) return prev + 1;
        if (prev < 95) return prev + (Math.random() > 0.5 ? 1 : 0);
        if (prev < 98) return prev + (Math.random() > 0.7 ? 1 : 0);
        return prev;
      });
    }, 400);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [isOpen]);

  // When parent signals completion
  useEffect(() => {
    if (isCompleted) {
      setProgress(100);
    }
  }, [isCompleted]);

  if (!isOpen) return null;

  const currentStepIndex = isCompleted
    ? STEPS.length
    : STEPS.findIndex((s) => progress < s.threshold);
  const activeStep = currentStepIndex === -1 ? STEPS.length - 1 : currentStepIndex;

  const displayPercent = isCompleted ? 100 : Math.min(progress, 98);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative overflow-hidden text-slate-800">
        {/* Subtle background glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close / Cancel Button */}
        {onCancel && !isCompleted && (
          <button
            onClick={onCancel}
            title="ยกเลิกการรอ"
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Center Icon & Percentage */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${
                isCompleted
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
                  : "bg-indigo-50 border border-indigo-100 text-indigo-600"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600 animate-in zoom-in-50 duration-200" />
              ) : (
                <Sparkles className="w-9 h-9 animate-pulse text-indigo-600" />
              )}
            </div>
            <span
              className={`absolute -bottom-2 -right-2 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow transition-colors duration-300 ${
                isCompleted ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
              }`}
            >
              {displayPercent}%
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900">
            {isCompleted ? "สกัดข้อมูลจาก PDF สำเร็จแล้ว!" : "AI กำลังอ่านและสกัดข้อมูลจาก PDF"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[280px] truncate font-medium">
            {fileName || "เอกสาร PDF"}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out shadow-xs ${
                isCompleted
                  ? "bg-emerald-500"
                  : "bg-linear-to-r from-indigo-500 via-indigo-600 to-indigo-700"
              }`}
              style={{ width: `${displayPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              เวลาที่ใช้: {elapsed} วินาที
            </span>
            <span
              className={`font-bold ${isCompleted ? "text-emerald-600" : "text-indigo-600"}`}
            >
              {displayPercent}%
            </span>
          </div>
        </div>

        {/* Dynamic Step Status List */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2.5">
          {STEPS.map((step, idx) => {
            const isDone = isCompleted || progress >= step.threshold;
            const isCurrent = !isCompleted && activeStep === idx;
            const StepIcon = step.icon;

            return (
              <div
                key={idx}
                className={`flex items-center space-x-2.5 text-xs transition-opacity duration-200 ${
                  isDone
                    ? "text-emerald-800 font-semibold"
                    : isCurrent
                    ? "text-indigo-950 font-bold"
                    : "text-slate-400 opacity-60"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                    isDone
                      ? "bg-emerald-100 text-emerald-600"
                      : isCurrent
                      ? "bg-indigo-100 text-indigo-600 animate-spin"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <StepIcon className="w-3 h-3 animate-pulse" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-center text-slate-500 mt-4 font-medium">
          {isCompleted
            ? "กำลังนำข้อมูลใส่ลงฟอร์ม..."
            : "ระบบกำลังส่งหน้าเอกสารให้ Gemini AI สกัดตัวเลขและตาราง..."}
        </p>
      </div>
    </div>
  );
}
