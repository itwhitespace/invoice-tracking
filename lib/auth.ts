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
    // Surface the specific reason when we know it — "invalid credentials"
    // and "account not confirmed yet" need very different fixes.
    const msg = authError.message || "";
    if (/email not confirmed/i.test(msg)) {
      return {
        success: false,
        error: "บัญชีนี้ยังไม่ได้ยืนยันอีเมล — ไปที่ Supabase Dashboard > Authentication > Users แล้วกด Confirm",
      };
    }
    return { success: false, error: "อีเมลหรือ PIN ไม่ถูกต้อง" };
  }

  await supabase.rpc("reset_login_lockout", { p_username: cleanEmail });
  return { success: true };
}

export async function signOut(supabase: SupabaseClient) {
  await supabase.auth.signOut();
}

// "Forgot PIN" — sends a recovery email whose link lands on /reset-password
// directly (bypassing the homepage entirely, so there's no risk of a
// server redirect discarding the recovery token before we can use it).
export async function requestPinReset(
  supabase: SupabaseClient,
  email: string
): Promise<{ error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return { error: "กรุณากรอกอีเมล" };
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  return { error: error ? error.message : null };
}

// Sets a new PIN for whoever the current (recovery) session belongs to.
export async function updatePin(
  supabase: SupabaseClient,
  newPin: string
): Promise<{ error: string | null }> {
  if (!/^\d{6}$/.test(newPin)) return { error: "PIN ต้องเป็นตัวเลข 6 หลัก" };
  const { error } = await supabase.auth.updateUser({ password: newPin });
  return { error: error ? error.message : null };
}
