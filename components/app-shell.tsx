"use client";

import { useEffect, useMemo, useState, ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  CalendarRange,
  FileSearch,
  UploadCloud,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  LogOut,
  Loader2,
  UserCircle2,
} from "lucide-react";
import { COMPANY_OPTIONS } from "@/lib/company-utils";
import { useSettings } from "@/lib/settings-context";
import { getSupabaseClient } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

const SIDEBAR_COLLAPSED_KEY = "invoice_tracking_sidebar_collapsed";

// Pages reachable without being logged in — /login itself (rendered bare,
// no sidebar) and /settings (needs to stay reachable so a brand-new browser
// can configure the Supabase URL/key before any login is even possible).
const PUBLIC_PATHS = ["/settings"];

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
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  // undefined = still checking, null = confirmed logged out, Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const supabase = useMemo(
    () => getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey),
    [settings.supabaseUrl, settings.supabaseAnonKey]
  );

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

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Fires once Supabase's client consumes a recovery link's token from
      // the URL (wherever it landed) — send them to set a new PIN instead
      // of quietly dropping them into the normal app as if logged in.
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      }
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname?.startsWith(p + "/"));

  useEffect(() => {
    if (pathname === "/login" || pathname === "/reset-password" || isPublicPath) return;
    if (session === null) router.replace("/login");
  }, [session, isPublicPath, pathname, router]);

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

  const handleLogout = async () => {
    if (supabase) await signOut(supabase);
    router.replace("/login");
  };

  // Login and the password-reset landing page render their own full-page
  // layout — no sidebar, no guard.
  if (pathname === "/login" || pathname === "/reset-password") {
    return <>{children}</>;
  }

  // Protected page, session not resolved yet — hold off rendering the app
  // chrome (and definitely the page content) until we know one way or another.
  if (!isPublicPath && session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!isPublicPath && session === null) {
    return null; // redirecting to /login via the effect above
  }

  const username = session?.user?.email?.split("@")[0] || "";

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

        {/* Logged-in user + Logout */}
        {session && (
          <div className="border-t border-slate-200 p-2 shrink-0">
            {!collapsed && username && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-500">
                <UserCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{username}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title={collapsed ? "ออกจากระบบ" : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 transition ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span>ออกจากระบบ</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden">{children}</main>
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
