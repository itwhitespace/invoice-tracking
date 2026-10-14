"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Loader2, Pencil, X, Trash2, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { COMPANY_OPTIONS, getCompanyLabel } from "@/lib/company-utils";
import {
  AppUser,
  PERMISSIONS,
  PERMISSION_TEMPLATES,
  PermissionKey,
  TemplateKey,
  describeUserLevel,
  matchTemplate,
} from "@/lib/permissions";
import { RequirePermission } from "@/components/require-permission";
import { DesktopOnlyNotice } from "@/components/desktop-only-notice";

export default function UsersPage() {
  return (
    <RequirePermission perm="admin">
      <UsersContent />
    </RequirePermission>
  );
}

function UsersContent() {
  const supabase = getSupabaseClient();
  const { session } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  // undefined = couldn't load (e.g. the SQL function isn't installed yet)
  const [lastSignIns, setLastSignIns] = useState<Record<string, string | null> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    const [{ data, error }, signIns] = await Promise.all([
      supabase.from("app_users").select("*").order("email"),
      supabase.rpc("app_user_last_sign_ins"),
    ]);
    if (error) setLoadError(error.message);
    else {
      setLoadError("");
      setUsers((data as AppUser[]) || []);
    }
    if (signIns.error) {
      console.warn("Last sign-in times unavailable:", signIns.error.message);
      setLastSignIns(undefined);
    } else {
      const map: Record<string, string | null> = {};
      for (const row of (signIns.data as { email: string; last_sign_in_at: string | null }[]) || []) {
        map[row.email] = row.last_sign_in_at;
      }
      setLastSignIns(map);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => {
    const tpl = PERMISSION_TEMPLATES.find((t) => t.key === "viewer")!;
    setIsNew(true);
    setEditing({
      email: "",
      display_name: "",
      companies: [],
      permissions: [...tpl.permissions],
      is_admin: false,
      template: "viewer",
    });
  };

  return (
    <div className="relative h-full flex flex-col bg-slate-100 overflow-hidden">
      <DesktopOnlyNotice pageName="ผู้ใช้งาน" />
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-700" />
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">ผู้ใช้งาน</h1>
          <span className="text-[11px] text-slate-400 ml-1">กำหนดว่าใครเข้าระบบได้ เห็นบริษัทไหน และทำอะไรได้บ้าง</span>
        </div>
        <button
          onClick={startAdd}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          เพิ่มผู้ใช้
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="p-6 text-xs text-red-700">โหลดรายชื่อไม่สำเร็จ: {loadError}</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">อีเมล</th>
                  <th className="p-3.5">ชื่อ</th>
                  <th className="p-3.5">สิทธิ์</th>
                  <th className="p-3.5">บริษัทที่เห็น</th>
                  <th className="p-3.5">เข้าใช้ล่าสุด</th>
                  <th className="p-3.5 w-24 text-center">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.email} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-mono text-slate-800">
                      {u.email}
                      {u.email === session?.user.email?.toLowerCase() && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-indigo-600">(คุณ)</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">{u.display_name || "-"}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                          u.is_admin
                            ? "bg-slate-900 text-white border-slate-900"
                            : matchTemplate(u)
                              ? "bg-slate-100 text-slate-700 border-slate-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {u.is_admin && <ShieldCheck className="w-3 h-3" />}
                        {describeUserLevel(u)}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {u.is_admin
                        ? "ทุกบริษัท"
                        : u.companies.length === 0
                          ? <span className="text-red-600">ยังไม่ได้เลือก</span>
                          : u.companies.map(getCompanyLabel).join(", ")}
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      <LastSignIn value={lastSignIns === undefined ? undefined : lastSignIns[u.email] ?? null} />
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => {
                          setIsNew(false);
                          setEditing(u);
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                        title="แก้ไขสิทธิ์"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="max-w-5xl text-[11px] text-slate-500 mt-3 leading-relaxed">
          ผู้ใช้ที่เพิ่มแล้วเข้าระบบได้ทันทีด้วยอีเมลของตัวเอง (ระบบส่งรหัส 6 หลักให้ทางอีเมล) — ระบบไม่ได้ส่งคำเชิญให้อัตโนมัติ
          กรุณาแจ้งผู้ใช้เองว่าเข้าได้แล้ว
        </p>
      </div>

      {editing && (
        <UserEditor
          user={editing}
          isNew={isNew}
          isSelf={editing.email === session?.user.email?.toLowerCase()}
          existingEmails={users.map((u) => u.email)}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LastSignIn({ value }: { value: string | null | undefined }) {
  if (value === undefined) return <span className="text-slate-300">-</span>;
  if (value === null) return <span className="text-slate-400 italic">ยังไม่เคยเข้า</span>;

  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  const relative = days <= 0 ? "วันนี้" : days === 1 ? "เมื่อวาน" : `${days} วันก่อน`;
  return (
    <span title={date.toLocaleString("th-TH")}>
      <span className={days > 30 ? "text-amber-700 font-medium" : ""}>{relative}</span>
      <span className="block text-[10.5px] text-slate-400 font-mono">
        {date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}{" "}
        {date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </span>
  );
}

function UserEditor({
  user,
  isNew,
  isSelf,
  existingEmails,
  onClose,
  onSaved,
}: {
  user: AppUser;
  isNew: boolean;
  isSelf: boolean;
  existingEmails: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const supabase = getSupabaseClient();
  const { refreshAppUser } = useAuth();
  const [draft, setDraft] = useState<AppUser>(user);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const email = draft.email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailTaken = isNew && existingEmails.includes(email);
  const matched = matchTemplate(draft);
  const baseTemplate = PERMISSION_TEMPLATES.find((t) => t.key === draft.template);

  const applyTemplate = (key: TemplateKey) => {
    const tpl = PERMISSION_TEMPLATES.find((t) => t.key === key)!;
    if (isSelf && draft.is_admin && !tpl.isAdmin) {
      setError("ไม่สามารถถอดสิทธิ์ผู้ดูแลระบบของตัวเองได้");
      return;
    }
    setError("");
    setDraft({ ...draft, template: key, is_admin: tpl.isAdmin, permissions: [...tpl.permissions] });
  };

  const togglePerm = (key: PermissionKey) => {
    const has = draft.permissions.includes(key);
    setDraft({ ...draft, permissions: has ? draft.permissions.filter((p) => p !== key) : [...draft.permissions, key] });
  };

  const toggleCompany = (value: string) => {
    const has = draft.companies.includes(value);
    setDraft({ ...draft, companies: has ? draft.companies.filter((c) => c !== value) : [...draft.companies, value] });
  };

  const save = async () => {
    if (!supabase) return;
    setIsSaving(true);
    setError("");
    const row = {
      email,
      display_name: draft.display_name?.trim() || null,
      companies: draft.companies,
      // Admins get every permission regardless — store the full set so the
      // row still reads correctly if the Admin flag is later removed.
      permissions: draft.is_admin ? PERMISSIONS.map((p) => p.key) : draft.permissions,
      is_admin: draft.is_admin,
      template: draft.template,
    };
    const { error: saveError } = isNew
      ? await supabase.from("app_users").insert(row)
      : await supabase.from("app_users").update(row).eq("email", user.email);
    setIsSaving(false);
    if (saveError) {
      setError("บันทึกไม่สำเร็จ: " + saveError.message);
      return;
    }
    if (isSelf) await refreshAppUser();
    await onSaved();
  };

  const remove = async () => {
    if (!supabase) return;
    setIsSaving(true);
    const { error: deleteError } = await supabase.from("app_users").delete().eq("email", user.email);
    setIsSaving(false);
    if (deleteError) {
      setError("ลบไม่สำเร็จ: " + deleteError.message);
      setConfirmDelete(false);
      return;
    }
    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">{isNew ? "เพิ่มผู้ใช้" : "แก้ไขสิทธิ์ผู้ใช้"}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">อีเมล</label>
              <input
                type="email"
                value={draft.email}
                disabled={!isNew}
                autoFocus={isNew}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="name@company.com"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono text-xs disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              {isNew && emailTaken && <p className="text-[10.5px] text-red-600">อีเมลนี้มีอยู่ในรายชื่อแล้ว</p>}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">ชื่อที่แสดง (ไม่บังคับ)</label>
              <input
                type="text"
                value={draft.display_name || ""}
                onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">เริ่มจาก Template</label>
            <div className="flex items-center gap-2">
              <select
                value={draft.template || ""}
                onChange={(e) => applyTemplate(e.target.value as TemplateKey)}
                className="flex-1 px-2.5 py-2 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {PERMISSION_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              {!matched && baseTemplate && (
                <span className="text-[10.5px] font-semibold text-amber-700 shrink-0">ปรับเองจาก Template</span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500">
              เลือก Template แล้วระบบติ๊กให้ตามชุดนั้น ปรับรายข้อด้านล่างได้ — การแก้ Template ในอนาคตไม่เปลี่ยนสิทธิ์ของคนนี้
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-600">บริษัทที่เห็น</label>
            <div className="flex flex-wrap gap-4">
              {COMPANY_OPTIONS.map((c) => (
                <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.is_admin || draft.companies.includes(c.value)}
                    disabled={draft.is_admin}
                    onChange={() => toggleCompany(c.value)}
                    className="w-4 h-4 accent-slate-900"
                  />
                  <span className="text-slate-800 font-medium">{c.value}</span>
                </label>
              ))}
            </div>
            {!draft.is_admin && draft.companies.length === 0 && (
              <p className="text-[10.5px] text-amber-700">ยังไม่ได้เลือกบริษัท — ผู้ใช้จะเข้าระบบได้แต่ไม่เห็นข้อมูลใดๆ</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-600">สิทธิ์</label>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {PERMISSIONS.map((p) => {
                const differs = !!baseTemplate && !draft.is_admin && baseTemplate.permissions.includes(p.key) !== draft.permissions.includes(p.key);
                return (
                  <label key={p.key} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50/70">
                    <input
                      type="checkbox"
                      checked={draft.is_admin || draft.permissions.includes(p.key)}
                      disabled={draft.is_admin}
                      onChange={() => togglePerm(p.key)}
                      className="w-4 h-4 mt-0.5 accent-slate-900 shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="text-slate-800 font-medium">{p.label}</span>
                      <span className="block text-[10.5px] text-slate-500">{p.hint}</span>
                    </span>
                    {differs && <span className="text-[10px] font-semibold text-amber-700 shrink-0">ต่างจาก Template</span>}
                  </label>
                );
              })}
              <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer bg-slate-50/60">
                <input
                  type="checkbox"
                  checked={draft.is_admin}
                  disabled={isSelf && user.is_admin}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      is_admin: !draft.is_admin,
                      permissions: !draft.is_admin ? PERMISSIONS.map((x) => x.key) : draft.permissions,
                    })
                  }
                  className="w-4 h-4 mt-0.5 accent-slate-900 shrink-0"
                />
                <span className="flex-1 min-w-0">
                  <span className="text-slate-900 font-semibold">จัดการผู้ใช้และ Settings (สิทธิ์ผู้ดูแลระบบ)</span>
                  <span className="block text-[10.5px] text-slate-500">
                    ติ๊กแล้วได้ทุกสิทธิ์และเห็นทุกบริษัทอัตโนมัติ
                    {isSelf && user.is_admin && " — ถอดสิทธิ์ของตัวเองไม่ได้"}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          {!isNew && !isSelf ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-red-700 font-medium">ลบผู้ใช้นี้?</span>
                <button onClick={remove} disabled={isSaving} className="px-2.5 py-1 font-semibold text-white bg-red-600 hover:bg-red-700 rounded">
                  ลบ
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded">
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ลบผู้ใช้
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              ยกเลิก
            </button>
            <button
              onClick={save}
              disabled={isSaving || !emailValid || emailTaken}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
