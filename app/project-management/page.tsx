"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";

// Phase 1: the Project Management prototype is a self-contained HTML page
// (sample data, saved only in this browser). The menu opens this route in a
// new tab; once the permission check passes, it hands over to the prototype
// full-screen. Phase 2+ replaces it with React pages backed by Supabase.
const PROTOTYPE_SRC = "/pm/app-core-530bfc88324d.html";

function OpenPrototype() {
  useEffect(() => {
    window.location.replace(PROTOTYPE_SRC);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 p-6 text-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      <p className="text-xs">กำลังเปิด APP CORE Tracking…</p>
      <a href={PROTOTYPE_SRC} className="text-xs font-semibold text-slate-700 hover:underline">
        ถ้าไม่เปิดเอง กดที่นี่
      </a>
    </div>
  );
}

export default function ProjectManagementPage() {
  return (
    <RequirePermission perm="project_management">
      <OpenPrototype />
    </RequirePermission>
  );
}
