"use client";

import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PermissionKey } from "@/lib/permissions";

// Page-level gate for someone who opens a page's URL directly without the
// matching permission (the menu already hides these links).
export function RequirePermission({ perm, children }: { perm: PermissionKey | "admin"; children: ReactNode }) {
  const { can, isAdmin } = useAuth();
  const allowed = perm === "admin" ? isAdmin : can(perm);
  if (allowed) return <>{children}</>;

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 p-6 text-center">
      <ShieldAlert className="w-10 h-10 text-slate-400" />
      <p className="text-sm font-semibold text-slate-700">ไม่มีสิทธิ์ใช้งานหน้านี้</p>
      <p className="text-xs">หากต้องการใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
    </div>
  );
}
