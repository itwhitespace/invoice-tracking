"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Copy,
  FileCheck2,
  Loader2,
  Plus,
  Printer,
  Save,
  Trash2,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  Customer,
  CustomerSnapshot,
  EMPTY_CUSTOMER,
  EMPTY_ITEM,
  INVOICE_STATUS_LABELS,
  Invoice,
  InvoiceItem,
  IssuerCompany,
  addDaysIso,
  calculateInvoiceTotals,
  itemAmount,
  formatMoney2,
  issuerDisplayName,
  signedAssetUrl,
} from "@/lib/invoices";
import { DateInputDDMMYYYY } from "@/components/date-input-ddmmyyyy";
import { CustomerFields } from "@/components/customer-fields";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoice-document";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";

const WHT_OPTIONS = [0, 1, 2, 3, 5];
const A4_WIDTH_PX = 794; // 210mm at 96dpi

type Draft = Omit<Invoice, "id" | "created_at"> & { id?: string };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyDraft(companyKey: string, salesman: string): Draft {
  return {
    company_key: companyKey,
    doc_no: null,
    status: "draft",
    issue_date: todayIso(),
    credit_term_days: 30,
    due_date: null,
    salesman,
    project_name: "",
    quotation_no: "",
    ref_document: "",
    ship_to: "",
    customer_id: null,
    customer: { ...EMPTY_CUSTOMER },
    company: null,
    items: [{ ...EMPTY_ITEM }],
    discount: 0,
    vat_rate: 0,
    wht_rate: 0,
    subtotal: 0,
    after_discount: 0,
    vat_amount: 0,
    total: 0,
    wht_amount: 0,
    net_total: 0,
    notes: "",
    created_by: null,
    issued_by: null,
    issued_by_name: null,
    signature_path: null,
    issued_at: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
  };
}

export default function InvoiceEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { appUser, session } = useAuth();
  const isNew = params.id === "new";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [companies, setCompanies] = useState<IssuerCompany[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bankLogoUrl, setBankLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [confirm, setConfirm] = useState<null | "issue" | "void" | "delete">(null);
  const [voidReason, setVoidReason] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.7);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => setPreviewScale(Math.min(1.2, Math.max(0.3, (el.clientWidth - 32) / A4_WIDTH_PX)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [draft === null]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [comp, cust] = await Promise.all([
      supabase.from("issuer_companies").select("*"),
      supabase.from("customers").select("*").order("name"),
    ]);
    if (comp.error) {
      setError("โหลดข้อมูลบริษัทไม่สำเร็จ: " + comp.error.message + " — ถ้าเพิ่งเปิดใช้เมนูนี้ ให้รันไฟล์ supabase/invoices-setup.sql ก่อน");
      return;
    }
    const issuerList = ((comp.data as IssuerCompany[]) || []).sort((a, b) =>
      (a.created_at || "").localeCompare(b.created_at || "")
    );
    setCompanies(issuerList);
    setCustomers((cust.data as Customer[]) || []);

    if (isNew) {
      const firstCompany = issuerList[0]?.company_key || "";
      setDraft(emptyDraft(firstCompany, appUser?.display_name || session?.user.email || ""));
      return;
    }
    const { data, error: invErr } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle();
    if (invErr || !data) {
      setError("ไม่พบใบแจ้งหนี้นี้ หรือไม่มีสิทธิ์เปิด");
      return;
    }
    setDraft(data as Draft);
    setIsDirty(false);
    // Arriving straight from "ออกใบแจ้งหนี้" on a brand-new invoice.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1") {
      if ((data as Draft).status !== "draft") setShowPreview(true);
      window.history.replaceState(null, "", `/invoices/${params.id}`);
    }
  }, [supabase, isNew, params.id, appUser, session]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const isEditable = draft?.status === "draft";
  const companyProfile: IssuerCompany | null = useMemo(() => {
    if (!draft) return null;
    if (draft.status !== "draft" && draft.company) return draft.company;
    return companies.find((c) => c.company_key === draft.company_key) || null;
  }, [draft, companies]);

  // Draft previews show the signature of whoever will press "issue"; issued
  // ones keep the signature captured at issue time.
  const signaturePath = draft?.status === "draft" ? appUser?.signature_path : draft?.signature_path;

  useEffect(() => {
    signedAssetUrl(supabase, companyProfile?.logo_path).then(setLogoUrl);
  }, [supabase, companyProfile?.logo_path]);
  useEffect(() => {
    signedAssetUrl(supabase, companyProfile?.bank_logo_path).then(setBankLogoUrl);
  }, [supabase, companyProfile?.bank_logo_path]);
  useEffect(() => {
    signedAssetUrl(supabase, signaturePath).then(setSignatureUrl);
  }, [supabase, signaturePath]);

  const totals = draft ? calculateInvoiceTotals(draft) : null;
  const dueDate = draft ? addDaysIso(draft.issue_date, draft.credit_term_days) : null;

  const docData: InvoiceDocumentData | null =
    draft && totals
      ? {
          ...draft,
          ...(isEditable ? totals : {}),
          due_date: isEditable ? dueDate : draft.due_date,
          company: companyProfile,
        }
      : null;

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setIsDirty(true);
    setNotice("");
  };

  const updateItem = (idx: number, p: Partial<InvoiceItem>) => {
    if (!draft) return;
    patch({ items: draft.items.map((it, i) => (i === idx ? { ...it, ...p } : it)) });
  };

  const validationProblems = (): string[] => {
    if (!draft) return [];
    const problems: string[] = [];
    if (!draft.company_key || !companyProfile) problems.push("ยังไม่ได้เลือกบริษัทผู้ออก — เพิ่มบริษัทได้ที่แท็บ \"ข้อมูลบริษัท\"");
    if (!draft.customer.name.trim()) problems.push("ยังไม่ได้กรอกชื่อลูกค้า");
    if (!draft.items.some((it) => it.description.trim())) problems.push("ยังไม่มีรายการ");
    if ((totals?.net_total || 0) <= 0) problems.push("ยอดชำระต้องมากกว่า 0");
    if (draft.customer.tax_id && draft.customer.tax_id.replace(/\D/g, "").length !== 13)
      problems.push("เลขผู้เสียภาษีของลูกค้าต้องครบ 13 หลัก");
    if (!companyProfile?.name_th || !companyProfile?.tax_id) problems.push("ข้อมูลบริษัทผู้ออกยังไม่ครบ (ชื่อ/เลขผู้เสียภาษี) — ไปที่แท็บ \"ข้อมูลบริษัท\"");
    if (!appUser?.signature_path) problems.push("คุณยังไม่มีลายเซ็นในระบบ — ให้ Admin อัปโหลดในเมนูผู้ใช้งาน (ออกได้แต่ช่องลายเซ็นจะว่าง)");
    return problems;
  };

  // Returns the saved id, or null on failure. `navigate` is off when issuing,
  // which handles the redirect itself.
  const saveDraft = async (navigate = true): Promise<string | null> => {
    if (!supabase || !draft || !totals) return null;
    setIsBusy(true);
    setError("");
    const row = {
      company_key: draft.company_key,
      issue_date: draft.issue_date,
      credit_term_days: Number(draft.credit_term_days) || 0,
      due_date: dueDate,
      salesman: draft.salesman,
      project_name: draft.project_name,
      quotation_no: draft.quotation_no,
      ref_document: draft.ref_document,
      ship_to: draft.ship_to,
      customer_id: draft.customer_id,
      customer: draft.customer,
      items: draft.items.filter((it) => it.description.trim() || it.unit_price),
      discount: Number(draft.discount) || 0,
      vat_rate: Number(draft.vat_rate) || 0,
      wht_rate: Number(draft.wht_rate) || 0,
      notes: draft.notes,
      ...totals,
    };
    const res = draft.id
      ? await supabase.from("invoices").update(row).eq("id", draft.id).select("id").single()
      : await supabase
          .from("invoices")
          .insert({ ...row, status: "draft", created_by: session?.user.email || null })
          .select("id")
          .single();
    setIsBusy(false);
    if (res.error || !res.data) {
      setError("บันทึกไม่สำเร็จ: " + (res.error?.message || ""));
      return null;
    }
    setIsDirty(false);
    if (!draft.id) {
      if (navigate) router.replace(`/invoices/${res.data.id}`);
    } else if (navigate) {
      setNotice("บันทึกฉบับร่างแล้ว");
    }
    return res.data.id as string;
  };

  // Save, take the running number, then open the document ready to print.
  const issue = async () => {
    setConfirm(null);
    const wasNew = !draft?.id;
    const id = await saveDraft(false);
    if (!id || !supabase) return;
    setIsBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("issue_invoice", { p_invoice_id: id });
    setIsBusy(false);
    if (rpcErr) {
      setError("ออกใบแจ้งหนี้ไม่สำเร็จ: " + rpcErr.message);
      if (wasNew) router.replace(`/invoices/${id}`);
      return;
    }
    setNotice(`ออกใบแจ้งหนี้เลขที่ ${data} เรียบร้อย`);
    if (wasNew) {
      router.replace(`/invoices/${id}?preview=1`);
    } else {
      await load();
      setShowPreview(true);
    }
  };

  const voidInvoice = async () => {
    if (!supabase || !draft?.id) return;
    setConfirm(null);
    setIsBusy(true);
    const { error: rpcErr } = await supabase.rpc("void_invoice", { p_invoice_id: draft.id, p_reason: voidReason });
    setIsBusy(false);
    if (rpcErr) setError("ยกเลิกไม่สำเร็จ: " + rpcErr.message);
    else await load();
  };

  const deleteDraft = async () => {
    if (!supabase || !draft?.id) return;
    setConfirm(null);
    const { error: delErr } = await supabase.from("invoices").delete().eq("id", draft.id);
    if (delErr) setError("ลบไม่สำเร็จ: " + delErr.message);
    else router.replace("/invoices");
  };

  const duplicate = async () => {
    if (!supabase || !draft) return;
    setIsBusy(true);
    const copy = emptyDraft(draft.company_key, appUser?.display_name || session?.user.email || "");
    const { data, error: insErr } = await supabase
      .from("invoices")
      .insert({
        company_key: draft.company_key,
        status: "draft",
        issue_date: copy.issue_date,
        credit_term_days: draft.credit_term_days,
        due_date: addDaysIso(copy.issue_date, draft.credit_term_days),
        salesman: copy.salesman,
        project_name: draft.project_name,
        quotation_no: draft.quotation_no,
        ref_document: draft.ref_document,
        ship_to: draft.ship_to,
        customer_id: draft.customer_id,
        customer: draft.customer,
        items: draft.items,
        discount: draft.discount,
        vat_rate: draft.vat_rate,
        wht_rate: draft.wht_rate,
        notes: draft.notes,
        ...calculateInvoiceTotals(draft),
        created_by: session?.user.email || null,
      })
      .select("id")
      .single();
    setIsBusy(false);
    if (insErr || !data) setError("คัดลอกไม่สำเร็จ: " + (insErr?.message || ""));
    else router.push(`/invoices/${data.id}`);
  };

  const saveAsCustomer = async () => {
    if (!supabase || !draft) return;
    const { data, error: insErr } = await supabase.from("customers").insert(draft.customer).select("*").single();
    if (insErr || !data) {
      setError("บันทึกลูกค้าไม่สำเร็จ: " + (insErr?.message || ""));
      return;
    }
    setCustomers((cs) => [...cs, data as Customer].sort((a, b) => a.name.localeCompare(b.name)));
    patch({ customer_id: (data as Customer).id });
    setNotice("เพิ่มเข้ารายชื่อลูกค้าแล้ว");
  };

  if (error && !draft) {
    return <div className="p-8 text-xs text-red-700">{error}</div>;
  }
  if (!draft || !docData || !totals) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const status = INVOICE_STATUS_LABELS[draft.status];
  const inputClass =
    "w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-600";
  const sectionTitle = "text-xs font-bold text-slate-900 mb-2.5";

  return (
    <div className="h-full flex flex-col">
      {/* Action bar */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
        <Link href="/invoices" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" title="กลับไปรายการ">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-bold text-slate-900 font-mono">{draft.doc_no || "ใบแจ้งหนี้ใหม่ (ร่าง)"}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${status.classes}`}>{status.label}</span>
        {isDirty && <span className="text-[11px] text-amber-700">• มีการแก้ไขที่ยังไม่ได้บันทึก</span>}
        {notice && <span className="text-[11px] text-emerald-700">• {notice}</span>}

        <div className="ml-auto flex items-center gap-2">
          {isEditable ? (
            <>
              {draft.id && (
                <button onClick={() => setConfirm("delete")} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  ลบร่าง
                </button>
              )}
              <button
                onClick={() => saveDraft()}
                disabled={isBusy}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                บันทึกร่าง
              </button>
              <button
                onClick={() => setConfirm("issue")}
                disabled={isBusy}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
                ออกใบแจ้งหนี้
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPreview(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                ดูเอกสาร / พิมพ์
              </button>
              <button onClick={duplicate} disabled={isBusy} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" />
                คัดลอกเป็นใบใหม่
              </button>
              {draft.status === "issued" && (
                <button onClick={() => setConfirm("void")} className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  ยกเลิกเอกสาร
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-[11.5px] text-red-800">{error}</div>}
      {draft.status === "void" && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-[11.5px] text-red-800">
          เอกสารนี้ถูกยกเลิกแล้ว{draft.void_reason ? ` — เหตุผล: ${draft.void_reason}` : ""}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Form */}
        <div className="w-1/2 min-w-0 overflow-y-auto p-6 space-y-5">
          <fieldset disabled={!isEditable} className="space-y-5">
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className={sectionTitle}>บริษัทผู้ออกและรายละเอียดเอกสาร</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">บริษัทผู้ออก</label>
                  <select value={draft.company_key} onChange={(e) => patch({ company_key: e.target.value })} className={inputClass}>
                    {!draft.company_key && <option value="">— ยังไม่มีบริษัท —</option>}
                    {companies.map((c) => (
                      <option key={c.company_key} value={c.company_key}>
                        {issuerDisplayName(c)}
                      </option>
                    ))}
                  </select>
                  {companies.length === 0 && (
                    <Link href="/invoices/companies" className="text-[10.5px] text-indigo-600 underline">
                      เพิ่มบริษัทที่แท็บข้อมูลบริษัท
                    </Link>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">วันที่เอกสาร</label>
                  <DateInputDDMMYYYY
                    value={draft.issue_date}
                    onChange={(iso) => patch({ issue_date: iso })}
                    disabled={!isEditable}
                    className={`${inputClass} pr-8`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">เครดิต (วัน)</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.credit_term_days}
                    onChange={(e) => patch({ credit_term_days: parseInt(e.target.value || "0", 10) })}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">พนักงานขาย</label>
                  <input value={draft.salesman} onChange={(e) => patch({ salesman: e.target.value })} className={inputClass} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[11px] font-semibold text-slate-600">ชื่อโปรเจกต์</label>
                  <input value={draft.project_name} onChange={(e) => patch({ project_name: e.target.value })} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">เลขที่ใบเสนอราคา</label>
                  <input value={draft.quotation_no} onChange={(e) => patch({ quotation_no: e.target.value })} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">เอกสารอ้างอิง</label>
                  <input value={draft.ref_document} onChange={(e) => patch({ ref_document: e.target.value })} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">ที่อยู่จัดส่ง</label>
                  <input value={draft.ship_to} onChange={(e) => patch({ ship_to: e.target.value })} className={inputClass} />
                </div>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-2">
                ครบกำหนดชำระ: <span className="font-mono">{docData.due_date ? docData.due_date.split("-").reverse().join("/") : "-"}</span> — เลขที่เอกสารออกให้อัตโนมัติตอนกด &quot;ออกเอกสาร&quot; (IN-ปีเดือน + ลำดับ)
              </p>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold text-slate-900">ลูกค้า</h3>
                {isEditable && (
                  <div className="flex items-center gap-2">
                    <select
                      value={draft.customer_id || ""}
                      onChange={(e) => {
                        const c = customers.find((x) => x.id === e.target.value);
                        if (!c) {
                          patch({ customer_id: null });
                          return;
                        }
                        const { id, ...snapshot } = c;
                        patch({ customer_id: id, customer: { ...EMPTY_CUSTOMER, ...pickSnapshot(snapshot) } });
                      }}
                      className="px-2 py-1 text-[11px] border border-slate-300 rounded-md max-w-[240px]"
                    >
                      <option value="">— เลือกจากรายชื่อลูกค้า —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {!draft.customer_id && draft.customer.name.trim() && (
                      <button type="button" onClick={saveAsCustomer} className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded-md flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5" />
                        บันทึกเป็นลูกค้า
                      </button>
                    )}
                  </div>
                )}
              </div>
              <CustomerFields
                value={draft.customer}
                onChange={(customer: CustomerSnapshot) => patch({ customer })}
                disabled={!isEditable}
              />
              {isEditable && draft.customer_id && (
                <p className="text-[10.5px] text-slate-500 mt-2">แก้ข้อมูลตรงนี้มีผลเฉพาะใบนี้ ไม่เปลี่ยนข้อมูลในรายชื่อลูกค้า</p>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold text-slate-900">รายการ</h3>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => patch({ items: [...draft.items, { ...EMPTY_ITEM }] })}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มรายการ
                  </button>
                )}
              </div>
              <table className="w-full text-xs">
                <thead className="text-[11px] text-slate-500">
                  <tr>
                    <th className="text-left font-semibold pb-1.5 w-8">#</th>
                    <th className="text-left font-semibold pb-1.5">รายการ / รายละเอียด</th>
                    <th className="text-center font-semibold pb-1.5 w-20">จำนวน</th>
                    <th className="text-right font-semibold pb-1.5 w-28">ราคา/หน่วย</th>
                    <th className="text-right font-semibold pb-1.5 w-24">ส่วนลด</th>
                    <th className="text-right font-semibold pb-1.5 w-28">จำนวนเงิน</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="align-top">
                  {draft.items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-2 pr-2 space-y-1">
                        <input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="รายการ" className={inputClass} />
                        <textarea
                          rows={1}
                          value={it.detail}
                          onChange={(e) => updateItem(i, { detail: e.target.value })}
                          placeholder="รายละเอียด (ไม่บังคับ)"
                          className={`${inputClass} text-[11px]`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value || "0") })}
                          className={`${inputClass} text-center`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unit_price || ""}
                          onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value || "0") })}
                          className={`${inputClass} text-right font-mono`}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.discount || ""}
                          onChange={(e) => updateItem(i, { discount: parseFloat(e.target.value || "0") })}
                          className={`${inputClass} text-right font-mono`}
                        />
                      </td>
                      <td className="py-2 pl-1 text-right font-mono font-semibold text-slate-800 pt-3.5">
                        {formatMoney2(itemAmount(it))}
                      </td>
                      <td className="py-2 text-center pt-3">
                        {isEditable && draft.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => patch({ items: draft.items.filter((_, j) => j !== i) })}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">ส่วนลดพิเศษ (บาท)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.discount || ""}
                    onChange={(e) => patch({ discount: parseFloat(e.target.value || "0") })}
                    className={`${inputClass} text-right font-mono`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">VAT (%)</label>
                    <select value={draft.vat_rate} onChange={(e) => patch({ vat_rate: Number(e.target.value) })} className={inputClass}>
                      <option value={7}>7%</option>
                      <option value={0}>ไม่มี VAT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">หัก ณ ที่จ่าย (%)</label>
                    <select value={draft.wht_rate} onChange={(e) => patch({ wht_rate: Number(e.target.value) })} className={inputClass}>
                      {WHT_OPTIONS.map((w) => (
                        <option key={w} value={w}>
                          {w === 0 ? "ไม่หัก" : `${w}%`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">หมายเหตุเฉพาะใบนี้</label>
                  <textarea rows={2} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="text-xs space-y-1.5 self-start">
                {[
                  ["รวมเป็นเงิน", docData.subtotal],
                  ["หักส่วนลดพิเศษ", draft.discount],
                  ["ยอดรวมหลังหักส่วนลด", docData.after_discount],
                  [`VAT ${draft.vat_rate}%`, docData.vat_amount],
                  ["จำนวนเงินรวมทั้งสิ้น", docData.total],
                  [`หัก ณ ที่จ่าย ${draft.wht_rate}%`, docData.wht_amount],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-mono">{formatMoney2(value as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>ยอดชำระ</span>
                  <span className="font-mono">{formatMoney2(docData.net_total)}</span>
                </div>
              </div>
            </section>
          </fieldset>

          {!isEditable && draft.issued_by_name && (
            <p className="text-[11px] text-slate-500">
              ออกโดย {draft.issued_by_name} เมื่อ {draft.issued_at ? new Date(draft.issued_at).toLocaleString("th-TH") : "-"}
            </p>
          )}
        </div>

        {/* Live preview — scaled to fill its half of the screen */}
        <div ref={previewRef} className="w-1/2 min-w-0 overflow-y-auto bg-slate-200/70 border-l border-slate-200 p-4">
          <p className="text-[10.5px] text-slate-500 mb-2 text-center">ตัวอย่างเอกสาร</p>
          <div
            style={{ width: A4_WIDTH_PX * previewScale, height: A4_WIDTH_PX * Math.SQRT2 * previewScale }}
            className="mx-auto shadow-lg overflow-hidden"
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <InvoiceDocument data={docData} logoUrl={logoUrl} bankLogoUrl={bankLogoUrl} signatureUrl={signatureUrl} copyLabel="ต้นฉบับ / Original" />
            </div>
          </div>
        </div>
      </div>

      {showPreview && draft.id && draft.status !== "draft" && (
        <InvoicePreviewModal invoice={draft as Invoice} onClose={() => setShowPreview(false)} />
      )}

      {/* Confirm dialogs */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            {confirm === "issue" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">ยืนยันการออกใบแจ้งหนี้</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ระบบจะบันทึก ให้เลขที่เอกสารจริง และเปิดหน้าเอกสารให้พิมพ์ต่อทันที หลังออกแล้ว<b> แก้ไขไม่ได้</b> ทำได้เพียงยกเลิก
                  หรือคัดลอกเป็นใบใหม่
                </p>
                {validationProblems().length > 0 && (
                  <ul className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
                    {validationProblems().map((p) => (
                      <li key={p} className="flex gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setConfirm(null)} className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
                    กลับไปแก้ไข
                  </button>
                  <button
                    onClick={issue}
                    disabled={validationProblems().some((p) => !p.startsWith("คุณยังไม่มีลายเซ็น"))}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg"
                  >
                    ออกใบแจ้งหนี้
                  </button>
                </div>
              </>
            )}
            {confirm === "void" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">ยกเลิกใบแจ้งหนี้ {draft.doc_no}</h3>
                <p className="text-xs text-slate-600">เอกสารจะถูกประทับคำว่า &quot;ยกเลิก&quot; และเลขที่นี้จะไม่ถูกนำกลับมาใช้อีก</p>
                <input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="เหตุผล (ไม่บังคับ)"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button onClick={() => setConfirm(null)} className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">
                    ไม่ใช่
                  </button>
                  <button onClick={voidInvoice} className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">
                    ยืนยันยกเลิก
                  </button>
                </div>
              </>
            )}
            {confirm === "delete" && (
              <>
                <h3 className="text-sm font-bold text-slate-900">ลบฉบับร่างนี้?</h3>
                <div className="flex gap-2">
                  <button onClick={() => setConfirm(null)} className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">
                    ไม่ใช่
                  </button>
                  <button onClick={deleteDraft} className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">
                    ลบ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pickSnapshot(c: Omit<Customer, "id"> & Record<string, unknown>): CustomerSnapshot {
  return {
    name: c.name || "",
    tax_id: c.tax_id || "",
    branch: c.branch || "",
    address: c.address || "",
    phone: c.phone || "",
    contact_name: c.contact_name || "",
    contact_phone: c.contact_phone || "",
    contact_email: c.contact_email || "",
  };
}
