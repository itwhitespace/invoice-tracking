"use client";

import { ExternalLink } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";

// Phase 1: the Project Management prototype is a self-contained HTML page
// (sample data, saved only in this browser) shown inside the app shell.
// Phase 2+ replaces it with React pages backed by Supabase (pm_* tables).
const PROTOTYPE_SRC = "/pm/app-core-530bfc88324d.html";

export default function ProjectManagementPage() {
  return (
    <RequirePermission perm="project_management">
      <div className="h-full flex flex-col">
        <div className="h-9 px-3 flex items-center gap-3 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 shrink-0">
          <span className="font-semibold">ช่วงทดลอง</span>
          <span className="truncate">ข้อมูลเป็นตัวอย่าง และบันทึกไว้เฉพาะในเบราว์เซอร์นี้ ยังไม่เชื่อมฐานข้อมูล</span>
          <a
            href={PROTOTYPE_SRC}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline shrink-0"
          >
            เปิดเต็มจอ <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe src={PROTOTYPE_SRC} title="Project Management" className="flex-1 w-full border-0 bg-white" />
      </div>
    </RequirePermission>
  );
}
