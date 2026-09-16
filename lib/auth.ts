import { SupabaseClient } from "@supabase/supabase-js";

export interface LoginResult {
  success: boolean;
  error?: string;
  lockedUntil?: string;
}

// Checks the lockout table first (via a SECURITY DEFINER RPC — the client
// never touches that table directly), then attempts the real sign-in, and
// records the outcome so 5 wrong PINs in a row locks the account out.
// The identifier is the account's real email, exactly as created in the
// Supabase Dashboard (Authentication > Users) — no synthetic conversion.
export async function signInWithPin(
  supabase: SupabaseClient,
  email: string,
  pin: string
): Promise<LoginResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return { success: false, error: "กรุณากรอกอีเมล" };
  if (!/^\d{6}$/.test(pin)) return { success: false, error: "PIN ต้องเป็นตัวเลข 6 หลัก" };

  const { data: lockRows, error: lockError } = await supabase.rpc("check_login_lockout", {
    p_username: cleanEmail,
  });
  if (!lockError) {
    const lockInfo = lockRows?.[0];
    if (lockInfo?.is_locked) {
      return {
        success: false,
        error: "บัญชีนี้ถูกล็อกชั่วคราวจากการกรอกผิดหลายครั้ง กรุณาลองใหม่ภายหลัง",
        lockedUntil: lockInfo.locked_until,
      };
    }
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: pin,
  });

  if (authError) {
    await supabase.rpc("record_failed_login", { p_username: cleanEmail });
    return { success: false, error: "อีเมลหรือ PIN ไม่ถูกต้อง" };
  }

  await supabase.rpc("reset_login_lockout", { p_username: cleanEmail });
  return { success: true };
}

export async function signOut(supabase: SupabaseClient) {
  await supabase.auth.signOut();
}
