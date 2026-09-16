"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

interface DateInputDDMMYYYYProps {
  value: string; // ISO yyyy-mm-dd, or ""
  onChange: (isoValue: string) => void;
  className?: string;
}

function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatDigitsToMask(digits: string): string {
  const d = digits.slice(0, 8);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 2));
  if (d.length > 2) parts.push(d.slice(2, 4));
  if (d.length > 4) parts.push(d.slice(4, 8));
  return parts.join("/");
}

// null when the digits typed so far don't (yet) form a real calendar date.
function displayToIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Always DD/MM/YYYY regardless of the browser/OS locale — a native
// <input type="date"> silently follows the machine's locale (mm/dd/yyyy on
// a US-locale machine), which is easy to misread when typing by hand. A
// small calendar-icon button still opens a native picker for point-and-click.
export function DateInputDDMMYYYY({ value, onChange, className }: DateInputDDMMYYYYProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setText(formatDigitsToMask(digits));
    const iso = displayToIso(digits);
    if (iso) onChange(iso);
  };

  const openNativePicker = () => {
    const el = hiddenRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      el?.showPicker?.();
    } catch {
      // showPicker isn't available on every browser — typing remains the primary path.
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="DD/MM/YYYY"
        className={className}
      />
      <button
        type="button"
        onClick={openNativePicker}
        title="เลือกจากปฏิทิน"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 opacity-0 w-0 h-0 overflow-hidden"
      />
    </div>
  );
}
