import { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  icon: LucideIcon;
}

export function PagePlaceholder({ title, icon: Icon }: PagePlaceholderProps) {
  return (
    <div className="h-full flex flex-col bg-slate-100">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h1>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Icon className="w-10 h-10" />
        <p className="text-xs font-medium">เนื้อหาหน้านี้ยังไม่พร้อมใช้งาน (Coming Soon)</p>
      </div>
    </div>
  );
}
