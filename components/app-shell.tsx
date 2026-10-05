"use client";

import { useEffect, useState, ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  FileSearch,
  UploadCloud,
  Settings,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { COMPANY_OPTIONS } from "@/lib/company-utils";

const SIDEBAR_COLLAPSED_KEY = "invoice_tracking_sidebar_collapsed";

interface NavChild {
  label: string;
  href: string;
  companyValue: string;
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
    companyValue: c.value,
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
  { href: "/info", label: "Info", icon: Info },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="h-[100dvh] flex flex-col md:flex-row bg-slate-100 overflow-hidden font-sans">
      {/* Mobile top bar — the sidebar becomes a slide-in drawer below md */}
      <div className="md:hidden h-12 px-3 bg-white border-b border-slate-200 flex items-center gap-2.5 shrink-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="เปิดเมนู"
          className="p-1.5 text-slate-700 rounded-md active:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img src="/icon-WR.png" alt="WR" className="w-7 h-7 rounded-md object-cover" />
        <span className="text-sm font-bold text-slate-900 tracking-tight truncate">Invoice Tracking Program</span>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-xl flex flex-col"
            // Close once any menu link is tapped (submenu toggles stay open).
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMobileMenuOpen(false);
            }}
          >
            <div className="h-12 px-3 flex items-center justify-between border-b border-slate-200 shrink-0">
              <span className="text-sm font-bold text-slate-900">เมนู</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="ปิดเมนู"
                className="p-1.5 text-slate-500 rounded-md active:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Suspense fallback={null}>
                <SidebarNav
                  pathname={pathname}
                  collapsed={false}
                  expandedItems={expandedItems}
                  toggleExpanded={toggleExpanded}
                />
              </Suspense>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`hidden md:flex h-full shrink-0 bg-white border-r border-slate-200 flex-col transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          {!collapsed && (
            <div className="flex items-center space-x-2 min-w-0">
              <img
                src="/icon-WR.png"
                alt="WR"
                className="w-8 h-8 rounded-lg shrink-0 shadow-xs object-cover"
              />
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

        <Suspense fallback={null}>
          <SidebarNav
            pathname={pathname}
            collapsed={collapsed}
            expandedItems={expandedItems}
            toggleExpanded={toggleExpanded}
          />
        </Suspense>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 md:h-full overflow-hidden">{children}</main>
    </div>
  );
}

// Split out because it reads the company query param via useSearchParams(),
// which Next.js requires to sit inside a Suspense boundary.
function SidebarNav({
  pathname,
  collapsed,
  expandedItems,
  toggleExpanded,
}: {
  pathname: string | null;
  collapsed: boolean;
  expandedItems: Set<string>;
  toggleExpanded: (href: string) => void;
}) {
  const searchParams = useSearchParams();
  const currentCompany = searchParams.get("company") || "";

  return (
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

            {/* Company submenu — Project Roadmap / Proposal Preview only.
                A child counts as active only on its own page, with its own
                company selected (not just any submenu item sharing that
                company value). */}
            {hasSubmenu && isExpanded && (
              <div className="mt-1 ml-[1.15rem] pl-3 border-l border-slate-200 space-y-0.5">
                {item.children!.map((child) => {
                  const isChildActive = isActive && currentCompany === child.companyValue;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block px-2.5 py-1.5 rounded-md text-[11px] font-medium transition truncate ${
                        isChildActive
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
