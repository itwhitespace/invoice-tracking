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
  ChevronDown,
} from "lucide-react";
import { COMPANY_OPTIONS } from "@/lib/company-utils";

const SIDEBAR_COLLAPSED_KEY = "invoice_tracking_sidebar_collapsed";

interface NavChild {
  label: string;
  href: string;
}

interface NavItemDef {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children?: NavChild[];
}

// Project Roadmap and Proposal Preview each split into a submenu per
// company — data on each page is filtered by "Project by" (companyName).
const companySubmenu = (basePath: string): NavChild[] =>
  COMPANY_OPTIONS.map((c) => ({
    label: c.label,
    href: `${basePath}?company=${encodeURIComponent(c.value)}`,
  }));

const NAV_ITEMS: NavItemDef[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/project-roadmap",
    label: "Project Roadmap",
    icon: CalendarRange,
    children: companySubmenu("/project-roadmap"),
  },
  {
    href: "/proposal-preview",
    label: "Proposal Preview",
    icon: FileSearch,
    children: companySubmenu("/proposal-preview"),
  },
  { href: "/upload-proposal", label: "Upload Proposal", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored) setCollapsed(stored === "true");
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Auto-expand whichever parent item's page is currently active, so
  // arriving via a direct link (or a submenu link) still shows its submenu
  // open — without forcing other manually-opened items closed.
  useEffect(() => {
    const activeParent = NAV_ITEMS.find(
      (i) => i.children && (pathname === i.href || pathname?.startsWith(i.href + "/"))
    );
    if (!activeParent) return;
    setExpandedItems((prev) => {
      if (prev.has(activeParent.href)) return prev;
      const next = new Set(prev);
      next.add(activeParent.href);
      return next;
    });
  }, [pathname]);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

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
            const isExpanded = expandedItems.has(item.href);
            // Sub-nav items are unreachable in collapsed (icon-only) mode, so
            // there the parent still navigates directly like a normal link.
            const hasSubmenu = !!item.children && !collapsed;

            return (
              <div key={item.href}>
                {hasSubmenu ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.href)}
                    aria-expanded={isExpanded}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-semibold transition ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : (
                  <Link
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
                )}

                {/* Company submenu — Project Roadmap / Proposal Preview only */}
                {hasSubmenu && isExpanded && (
                  <div className="mt-1 ml-[1.15rem] pl-3 border-l border-slate-200 space-y-0.5">
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block px-2.5 py-1.5 rounded-md text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition truncate"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden">{children}</main>
    </div>
  );
}
