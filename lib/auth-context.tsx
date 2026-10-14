"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, clearLocalDataCaches, getLocalSavedRecords, isRemoteId } from "./supabase";
import { AppUser, PermissionKey } from "./permissions";
import { COMPANY_OPTIONS, CompanyOption } from "./company-utils";

// Which signed-in email the cached project data in this browser belongs to.
const CACHE_OWNER_KEY = "invoice_tracking_cache_owner";

interface AuthContextValue {
  isLoading: boolean;
  session: Session | null;
  appUser: AppUser | null;
  isAdmin: boolean;
  can: (perm: PermissionKey) => boolean;
  canSeeCompany: (companyName?: string) => boolean;
  visibleCompanies: CompanyOption[];
  refreshAppUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncCacheOwner(email: string) {
  try {
    const owner = localStorage.getItem(CACHE_OWNER_KEY);
    if (owner !== email) {
      clearLocalDataCaches();
      localStorage.setItem(CACHE_OWNER_KEY, email);
    }
  } catch (e) {
    console.error(e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppUser = useCallback(
    async (email: string | undefined) => {
      if (!supabase || !email) {
        setAppUser(null);
        return;
      }
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (error) console.warn("Failed to load user permissions:", error.message);
      setAppUser((data as AppUser) || null);
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user.email) syncCacheOwner(data.session.user.email.toLowerCase());
      await loadAppUser(data.session?.user.email);
      if (!cancelled) setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (newSession?.user.email) syncCacheOwner(newSession.user.email.toLowerCase());
        // Deferred: calling Supabase from inside this callback can deadlock the auth client.
        setTimeout(() => loadAppUser(newSession?.user.email), 0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadAppUser]);

  const isAdmin = !!appUser?.is_admin;

  const can = useCallback(
    (perm: PermissionKey) => !!appUser && (appUser.is_admin || appUser.permissions.includes(perm)),
    [appUser]
  );

  const canSeeCompany = useCallback(
    (companyName?: string) =>
      !!appUser && !!companyName && (appUser.is_admin || appUser.companies.includes(companyName)),
    [appUser]
  );

  const visibleCompanies = useMemo(
    () => COMPANY_OPTIONS.filter((c) => canSeeCompany(c.value)),
    [canSeeCompany]
  );

  const signOut = useCallback(async () => {
    const unsynced = getLocalSavedRecords().filter((r) => !isRemoteId(r.id)).length;
    if (
      unsynced > 0 &&
      !window.confirm(
        `มี ${unsynced} รายการที่บันทึกไว้เฉพาะในเครื่องนี้ ยังไม่ได้ส่งขึ้นฐานข้อมูล ถ้าออกจากระบบตอนนี้รายการเหล่านี้จะหายไป ต้องการออกจากระบบใช่หรือไม่?`
      )
    ) {
      return;
    }
    clearLocalDataCaches();
    try {
      localStorage.removeItem(CACHE_OWNER_KEY);
    } catch (e) {
      console.error(e);
    }
    await supabase?.auth.signOut();
    setAppUser(null);
  }, [supabase]);

  const refreshAppUser = useCallback(() => loadAppUser(session?.user.email), [loadAppUser, session]);

  return (
    <AuthContext.Provider
      value={{ isLoading, session, appUser, isAdmin, can, canSeeCompany, visibleCompanies, refreshAppUser, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
