import { SupabaseClient } from "@supabase/supabase-js";

// Supabase Auth only has email/phone identifiers, not plain usernames — so
// each username maps to a synthetic, never-emailed address at this fixed
// fake domain. Accounts are created in the Supabase Dashboard using this
// same convention (e.g. username "somchai" -> somchai@login.internal).
const EMAIL_DOMAIN = "login.internal";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  lockedUntil?: string;
}

// Checks the lockout table first (via a SECURITY DEFINER RPC — the client
// never touches that table directly), then attempts the real sign-in, and
// records the outcome so 5 wrong PINs in a row locks the username out.
export async function signInWithPin(
  supabase: SupabaseClient,
  username: string,
  pin: string
): Promise<LoginResult> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { success: false, error: "กรุณากรอกชื่อผู้ใช้" };
  if (!/^\d{6}$/.test(pin)) return { success: false, error: "PIN ต้องเป็นตัวเลข 6 หลัก" };

  const { data: lockRows, error: lockError } = await supabase.rpc("check_login_lockout", {
    p_username: cleanUsername,
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
    email: usernameToEmail(cleanUsername),
    password: pin,
  });

  if (authError) {
    await supabase.rpc("record_failed_login", { p_username: cleanUsername });
    return { success: false, error: "ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง" };
  }

  await supabase.rpc("reset_login_lockout", { p_username: cleanUsername });
  return { success: true };
}

export async function signOut(supabase: SupabaseClient) {
  await supabase.auth.signOut();
}
