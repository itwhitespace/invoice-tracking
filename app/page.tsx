"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// A client-side redirect, not a server one — Supabase puts recovery/auth
// tokens in the URL hash (#access_token=...), which browsers strip before
// a hard server redirect ever sees it. Redirecting here instead (after
// mount) gives AppShell's Supabase client a chance to consume that hash
// first; the eventual PASSWORD_RECOVERY event then takes over navigation.
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
