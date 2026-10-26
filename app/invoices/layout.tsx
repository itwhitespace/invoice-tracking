"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { DesktopOnlyNotice } from "@/components/desktop-only-notice";

const TABS = [
  { href: "/invoices", label: "ใบแจ้งหนี้" },
  { href: "/invoices/receipts", label: "ใบเสร็จรับเงิน" },
  { href: "/invoices/companies", label: "ข้อมูลบริษัท" },
  { href: "/invoices/customers", label: "รายชื่อลูกค้า" },
];

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const activeTab =
    TABS.slice(1).find((t) => pathname.startsWith(t.href))?.href ?? "/invoices";

  return (
    <RequirePermission perm="issue_documents">
      <div className="relative h-full flex flex-col bg-slate-100 overflow-hidden">
        <DesktopOnlyNotice pageName="ใบแจ้งหนี้" />
        <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center gap-6 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700" />
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">ใบแจ้งหนี้</h1>
          </div>
          <nav className="flex items-center gap-1 h-full">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`h-full flex items-center px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === t.href
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </RequirePermission>
  );
}
