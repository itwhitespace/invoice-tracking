import { NextResponse } from "next/server";

// Supabase connection for the APP CORE Tracker page (public/pm/*.html), which is
// a static file and can't read env vars itself. Both values are public (they are
// already in the app's browser bundle); access is enforced by RLS in Supabase.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      url: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
      anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
