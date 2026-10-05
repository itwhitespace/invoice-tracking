import Link from "next/link";
import { Monitor } from "lucide-react";

// Covers a desktop-only page on phones (below md). The mobile layout is
// view-only, and pages like Upload Proposal / Settings are all editing —
// the parent must be `relative` so this overlay fills it.
export function DesktopOnlyNotice({ pageName }: { pageName: string }) {
  return (
    <div className="md:hidden absolute inset-0 z-40 bg-slate-100 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
        <Monitor className="w-7 h-7 text-slate-500" />
      </div>
      <p className="text-sm font-bold text-slate-900">กรุณาใช้งานบนคอมพิวเตอร์</p>
      <p className="text-xs text-slate-500">
        หน้า {pageName} ใช้สำหรับแก้ไขข้อมูล จึงรองรับเฉพาะหน้าจอคอมพิวเตอร์
      </p>
      <Link
        href="/dashboard"
        className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg active:bg-slate-700"
      >
        กลับไปหน้า Dashboard
      </Link>
    </div>
  );
}
