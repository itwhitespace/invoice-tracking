"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Search, UserPlus, X, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Customer, CustomerSnapshot, EMPTY_CUSTOMER, taxIdDigitCount } from "@/lib/invoices";
import { CustomerFields } from "@/components/customer-fields";

export default function CustomersPage() {
  const supabase = getSupabaseClient();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<(CustomerSnapshot & { id?: string }) | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) setLoadError(error.message);
    else setCustomers((data as Customer[]) || []);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = customers.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.tax_id.includes(q) || c.contact_name.toLowerCase().includes(q)
  );

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ / เลขผู้เสียภาษี / ผู้ติดต่อ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono">{filtered.length} ราย</span>
          <button
            onClick={() => setEditing({ ...EMPTY_CUSTOMER })}
            className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            เพิ่มลูกค้า
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="p-6 text-xs text-red-700">โหลดรายชื่อไม่สำเร็จ: {loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              {customers.length === 0 ? "ยังไม่มีรายชื่อลูกค้า" : "ไม่พบรายชื่อที่ค้นหา"}
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">ชื่อลูกค้า</th>
                  <th className="p-3.5">เลขผู้เสียภาษี</th>
                  <th className="p-3.5">ที่อยู่</th>
                  <th className="p-3.5">ผู้ติดต่อ</th>
                  <th className="p-3.5 w-16 text-center">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 align-top">
                    <td className="p-3.5 font-semibold text-slate-900">{c.name}</td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {c.tax_id || "-"}
                      {c.branch && <div className="text-[10.5px] font-sans text-slate-400">{c.branch}</div>}
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs">{c.address || "-"}</td>
                    <td className="p-3.5 text-slate-600">
                      {c.contact_name || "-"}
                      {(c.contact_phone || c.contact_email) && (
                        <div className="text-[10.5px] text-slate-400">{[c.contact_phone, c.contact_email].filter(Boolean).join(" • ")}</div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button onClick={() => setEditing(c)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <CustomerEditor
          initial={editing}
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

function CustomerEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: CustomerSnapshot & { id?: string };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const supabase = getSupabaseClient();
  const [draft, setDraft] = useState<CustomerSnapshot>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const isNew = !initial.id;

  const save = async () => {
    if (!supabase) return;
    setIsSaving(true);
    setError("");
    const { error: e } = isNew
      ? await supabase.from("customers").insert(draft)
      : await supabase.from("customers").update(draft).eq("id", initial.id!);
    setIsSaving(false);
    if (e) setError("บันทึกไม่สำเร็จ: " + e.message);
    else await onSaved();
  };

  const remove = async () => {
    if (!supabase || !initial.id) return;
    setIsSaving(true);
    const { error: e } = await supabase.from("customers").delete().eq("id", initial.id);
    setIsSaving(false);
    if (e) setError("ลบไม่สำเร็จ: " + e.message);
    else await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <h2 className="text-sm font-bold text-slate-900">{isNew ? "เพิ่มลูกค้า" : "แก้ไขข้อมูลลูกค้า"}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <CustomerFields value={draft} onChange={setDraft} />
          {error && <p className="text-[11px] text-red-600 mt-3">{error}</p>}
          {!isNew && (
            <p className="text-[10.5px] text-slate-500 mt-3">แก้ข้อมูลที่นี่ไม่เปลี่ยนใบแจ้งหนี้ที่ออกไปแล้ว</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-red-700 font-medium">ลบลูกค้ารายนี้?</span>
                <button onClick={remove} className="px-2.5 py-1 font-semibold text-white bg-red-600 rounded">ลบ</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 font-semibold text-slate-700 bg-slate-100 rounded">
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
                ลบลูกค้า
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              ยกเลิก
            </button>
            <button
              onClick={save}
              disabled={isSaving || !draft.name.trim() || (!!draft.tax_id && taxIdDigitCount(draft.tax_id) !== 13)}
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
