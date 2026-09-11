"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  FileSearch,
  UploadCloud,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  FileCheck,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "invoice_tracking_sidebar_collapsed";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/project-roadmap", label: "Project Roadmap", icon: CalendarRange },
  { href: "/proposal-preview", label: "Proposal Preview", icon: FileSearch },
  { href: "/upload-proposal", label: "Upload Proposal", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored) setCollapsed(stored === "true");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={`h-full shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          {!collapsed && (
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
                Invoice Tracking Program
              </span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "แสดงเมนู" : "ซ่อนเมนู"}
            className={`p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition shrink-0 ${
              collapsed ? "mx-auto" : ""
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden">{children}</main>
    </div>
  );
}
