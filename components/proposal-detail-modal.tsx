"use client";

import { SavedRecord, Department, PaymentStatus } from "@/lib/types";
import { getTotalWeeks } from "@/lib/timeframe-utils";
import {
  X,
  FileText,
  Calendar,
  Layers,
  CreditCard,
  Building2,
  Clock,
  Download,
  Eye,
  CheckCircle2,
  Percent,
  ClipboardCheck,
  HelpCircle,
  Save,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";

const DEPARTMENT_OPTIONS: Department[] = [
  "studio-1",
  "studio-2",
  "studio-3",
  "studio-4",
  "Signage",
  "Branding",
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "wait", label: "Wait" },
  { value: "invoice", label: "Invoice" },
  { value: "paid", label: "Paid" },
];

const PAYMENT_STATUS_SELECT_STYLES: Record<PaymentStatus, string> = {
  wait: "bg-amber-50 border-amber-300 text-amber-900",
  invoice: "bg-sky-50 border-sky-300 text-sky-900",
  paid: "bg-emerald-50 border-emerald-300 text-emerald-900",
};

interface ProposalDetailModalProps {
  isOpen: boolean;
  record: SavedRecord | null;
  onClose: () => void;
  onOpenPdf?: (record: SavedRecord) => void;
  onUpdate: (record: SavedRecord) => void | Promise<void>;
}

export function ProposalDetailModal({
  isOpen,
  record,
  onClose,
  onOpenPdf,
  onUpdate,
}: ProposalDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"all" | "fees" | "timeframes" | "payments" | "operations">("all");
  const [localRecord, setLocalRecord] = useState<SavedRecord | null>(record);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveSuccess, setShowApproveSuccess] = useState(false);

  useEffect(() => {
    setLocalRecord(record);
    setIsDirty(false);
  }, [record]);

  if (!isOpen || !localRecord) return null;

  const vatAmount = (localRecord.totalFee || 0) * 0.07;
  const grandTotal = (localRecord.totalFee || 0) + vatAmount;
  const totalWeeks = getTotalWeeks(localRecord.timeFrames || []);

  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(localRecord, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${(localRecord.projectName || "proposal").replace(/\s+/g, "_")}_data.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // All field edits below only touch local state — nothing is persisted
  // until the Save button (shown once something is dirty) is pressed.
  const handleUpdatePaymentPercentage = (idx: number, val: string) => {
    const pct = parseFloat(val) || 0;
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    updatedTerms[idx] = {
      ...updatedTerms[idx],
      paymentPercentage: pct,
      amount: Math.round((localRecord.totalFee * pct) / 100),
    };
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  const handleUpdatePaymentWeek = (idx: number, val: string) => {
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    updatedTerms[idx] = {
      ...updatedTerms[idx],
      paymentWeek: val ? parseInt(val, 10) : undefined,
    };
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  // Setting an invoice date puts the milestone into "Wait" by default;
  // clearing the date drops the status (and its Invoice/Paid dates) too,
  // since there's nothing left to track.
  const handleUpdateInvoiceDate = (idx: number, val: string) => {
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    const current = { ...updatedTerms[idx] };
    current.invoiceDate = val || undefined;
    if (val && !current.paymentStatus) {
      current.paymentStatus = "wait";
    } else if (!val) {
      current.paymentStatus = undefined;
      current.invoiceIssuedDate = undefined;
      current.paidDate = undefined;
    }
    updatedTerms[idx] = current;
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  // Admin-only manual override once an invoice date has been scheduled.
  // Moving into Invoice/Paid defaults that status's date to today — still
  // editable via the next column.
  const handleUpdatePaymentStatus = (idx: number, val: string) => {
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    const current = { ...updatedTerms[idx] };
    const newStatus = (val || undefined) as PaymentStatus | undefined;
    current.paymentStatus = newStatus;
    const today = new Date().toISOString().slice(0, 10);
    if (newStatus === "invoice" && !current.invoiceIssuedDate) {
      current.invoiceIssuedDate = today;
    } else if (newStatus === "paid" && !current.paidDate) {
      current.paidDate = today;
    }
    updatedTerms[idx] = current;
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  // The status-specific date column: edits invoiceIssuedDate while status is
  // Invoice, or paidDate while status is Paid.
  const handleUpdateStatusDate = (idx: number, val: string) => {
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    const current = { ...updatedTerms[idx] };
    if (current.paymentStatus === "paid") {
      current.paidDate = val || undefined;
    } else if (current.paymentStatus === "invoice") {
      current.invoiceIssuedDate = val || undefined;
    }
    updatedTerms[idx] = current;
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  const handleOperationFieldChange = (field: "startDate" | "department", val: string) => {
    setLocalRecord({ ...localRecord, [field]: val });
    setIsDirty(true);
  };

  const handleSaveChanges = async () => {
    if (!localRecord) return;
    setIsSaving(true);
    try {
      await onUpdate(localRecord);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmApprove = async () => {
    const updated: SavedRecord = {
      ...localRecord,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };
    setLocalRecord(updated);
    setShowApproveConfirm(false);
    setIsSaving(true);
    try {
      await onUpdate(updated);
      setIsDirty(false);
      setShowApproveSuccess(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 line-clamp-1">
                  {localRecord.projectName || "รายละเอียดเอกสาร"}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 capitalize">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  {localRecord.status || "pending"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {localRecord.companyName ? `บริษัท: ${localRecord.companyName} • ` : ""}
                บันทึกเมื่อ: {new Date(localRecord.created_at).toLocaleString("th-TH")} • ไฟล์: {localRecord.pdfFileName || "เอกสารตัวอย่าง"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {localRecord.pdfUrl && onOpenPdf && (
              <button
                onClick={() => onOpenPdf(localRecord)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                View PDF
              </button>
            )}
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
              title="ส่งออกเป็น JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              JSON
            </button>
            <button
              onClick={handleRequestClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-2 bg-white shrink-0 text-xs font-medium text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "all"
                ? "border-slate-900 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            ภาพรวมทั้งหมด (Overview)
          </button>
          <button
            onClick={() => setActiveTab("fees")}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "fees"
                ? "border-slate-900 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            ค่าบริการออกแบบ ({localRecord.designFeeItems?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("timeframes")}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "timeframes"
                ? "border-slate-900 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            ระยะเวลาดำเนินงาน ({localRecord.timeFrames?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "payments"
                ? "border-slate-900 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            งวดการชำระเงิน ({localRecord.paymentTerms?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("operations")}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "operations"
                ? "border-slate-900 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900"
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            รายละเอียดการดำเนินงาน
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Section 1: General Info & Financial Summary (Always shown or in 'all') */}
          {(activeTab === "all" || activeTab === "fees") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project Info Card */}
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>ข้อมูลโครงการ (Project Information)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">บริษัทผู้ออกเอกสาร (Company)</span>
                    <span className="font-semibold text-slate-800">{localRecord.companyName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">ชื่อโครงการ</span>
                    <span className="font-semibold text-slate-800">{localRecord.projectName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">ขนาดพื้นที่ (Area)</span>
                    <span className="font-semibold text-slate-800">{localRecord.area || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">ขอบเขตงาน (Scope of Work)</span>
                    <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {localRecord.scopeOfWork || "-"}
                    </p>
                  </div>
                  {localRecord.totalDesignDuration && (
                    <div className="col-span-2 flex items-center gap-1.5 text-slate-600 pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] text-slate-400">ระยะเวลารวม:</span>
                      <span className="font-medium text-slate-800">{localRecord.totalDesignDuration}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>สรุปค่าบริการ (Fee Summary)</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Total Fee:</span>
                      <span className="font-mono font-bold text-slate-900">
                        ฿{Number(localRecord.totalFee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {localRecord.specialDiscount ? (
                      <div className="flex justify-between items-center text-amber-600">
                        <span>Special Discount:</span>
                        <span className="font-mono font-medium">
                          -฿{Number(localRecord.specialDiscount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center text-slate-500 text-[11px]">
                      <span>VAT 7%:</span>
                      <span className="font-mono">
                        ฿{vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-900">Grand Total:</span>
                    <span className="text-base font-black font-mono text-indigo-900">
                      ฿{grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Design Fee Items Table */}
          {(activeTab === "all" || activeTab === "fees") && localRecord.designFeeItems && localRecord.designFeeItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                  รายการค่าบริการวิชาชีพ (Design Fee Breakdown)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {localRecord.designFeeItems.length} รายการ
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 w-12 text-center">#</th>
                      <th className="px-4 py-2.5 w-48">รายการ (Item)</th>
                      <th className="px-4 py-2.5">รายละเอียด (Description)</th>
                      <th className="px-4 py-2.5 text-right w-36">จำนวนเงิน (THB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localRecord.designFeeItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.item}</td>
                        <td className="px-4 py-2.5 text-slate-600 leading-relaxed">{item.description}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Timeframes Table */}
          {(activeTab === "all" || activeTab === "timeframes") && localRecord.timeFrames && localRecord.timeFrames.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  ขั้นตอนและระยะเวลาดำเนินงาน (Project Timeframes)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {localRecord.timeFrames.length} ขั้นตอน
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 w-12 text-center">#</th>
                      <th className="px-4 py-2.5 w-48">ระยะงาน (Phase)</th>
                      <th className="px-4 py-2.5">รายละเอียดงาน (Description)</th>
                      <th className="px-4 py-2.5 text-right w-36">ระยะเวลา (Duration)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localRecord.timeFrames.map((tf, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{tf.phase}</td>
                        <td className="px-4 py-2.5 text-slate-600 leading-relaxed">{tf.description}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-indigo-700 bg-indigo-50/30">
                          {tf.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 4: Payment Terms Table (percentage editable, amount auto-calculated) */}
          {(activeTab === "all" || activeTab === "payments") && localRecord.paymentTerms && localRecord.paymentTerms.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-slate-600" />
                  เงื่อนไขและการแบ่งจ่ายเงิน (Payment Terms)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {localRecord.paymentTerms.length} งวด
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 w-12 text-center">#</th>
                      <th className="px-4 py-2.5">เงื่อนไขงวดงาน (Milestone)</th>
                      <th className="px-4 py-2.5 text-center w-28">สัดส่วน (%)</th>
                      <th className="px-4 py-2.5 text-center w-32">เก็บเงินสัปดาห์ที่</th>
                      <th className="px-4 py-2.5 text-center w-36">วันที่เรียกเก็บ</th>
                      <th className="px-4 py-2.5 text-center w-28">สถานะ</th>
                      <th className="px-4 py-2.5 text-center w-36">วันที่ Invoice/Paid</th>
                      <th className="px-4 py-2.5 text-right w-36">จำนวนเงิน (THB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localRecord.paymentTerms.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{pt.milestone}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={pt.paymentPercentage}
                              onChange={(e) => handleUpdatePaymentPercentage(idx, e.target.value)}
                              className="w-16 px-2 py-1 text-xs text-center font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                            <span className="text-slate-500 font-mono font-bold text-[11px]">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <select
                            value={pt.paymentWeek ?? ""}
                            onChange={(e) => handleUpdatePaymentWeek(idx, e.target.value)}
                            disabled={totalWeeks === 0}
                            title={
                              totalWeeks === 0
                                ? "ยังไม่มีข้อมูล Time Frame ให้อ้างอิงจำนวนสัปดาห์ทั้งหมด"
                                : undefined
                            }
                            className="w-full px-2 py-1 text-xs text-center font-mono font-semibold text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">- ยังไม่ระบุ -</option>
                            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                              <option key={w} value={w}>
                                Week {w}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="date"
                            value={pt.invoiceDate || ""}
                            onChange={(e) => handleUpdateInvoiceDate(idx, e.target.value)}
                            className="w-full px-2 py-1 text-xs text-center font-mono text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {pt.invoiceDate ? (
                            <select
                              value={pt.paymentStatus || "wait"}
                              onChange={(e) => handleUpdatePaymentStatus(idx, e.target.value)}
                              title="Admin: อัปเดตสถานะการชำระเงิน"
                              className={`w-full px-2 py-1 text-xs text-center font-bold rounded-md border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition capitalize ${
                                PAYMENT_STATUS_SELECT_STYLES[pt.paymentStatus || "wait"]
                              }`}
                            >
                              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {pt.paymentStatus === "invoice" || pt.paymentStatus === "paid" ? (
                            <input
                              type="date"
                              value={(pt.paymentStatus === "paid" ? pt.paidDate : pt.invoiceIssuedDate) || ""}
                              onChange={(e) => handleUpdateStatusDate(idx, e.target.value)}
                              className="w-full px-2 py-1 text-xs text-center font-mono text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          ฿{Number(pt.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500">
                กำหนดวันที่เรียกเก็บแล้วสถานะจะเริ่มที่ Wait โดยอัตโนมัติ — Admin ปรับเป็น Invoice / Paid ได้ภายหลัง
                พร้อมระบุวันที่ของสถานะนั้น ๆ ในคอลัมป์ถัดไป (อย่าลืมกด &quot;บันทึกข้อมูล&quot; ด้านล่างหลังแก้ไข)
              </div>
            </div>
          )}

          {/* Section 5: Operation Details + Approve */}
          {activeTab === "operations" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900">รายละเอียดการดำเนินงาน</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Start Date</label>
                    <input
                      type="date"
                      value={localRecord.startDate || ""}
                      onChange={(e) => handleOperationFieldChange("startDate", e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Department</label>
                    <select
                      value={localRecord.department || ""}
                      onChange={(e) => handleOperationFieldChange("department", e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    >
                      <option value="">— ยังไม่ระบุ —</option>
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {localRecord.status === "approved" ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        อนุมัติแล้วเมื่อ {localRecord.approvedAt ? new Date(localRecord.approvedAt).toLocaleString("th-TH") : "-"}
                      </span>
                    ) : (
                      <span>เมื่อกด Approve สถานะจะเปลี่ยนเป็น &quot;Approved&quot; และไปแสดงที่ Project Roadmap</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={localRecord.status === "approved"}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-sm transition shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {localRecord.status === "approved" ? "Approved" : "Approve"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>
              ID: <span className="font-mono font-semibold text-slate-700">{localRecord.id}</span>
            </span>
            {isDirty && (
              <span className="text-amber-700 font-medium">• มีการแก้ไขที่ยังไม่ได้บันทึก</span>
            )}
          </div>
          {isDirty ? (
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              บันทึกข้อมูล
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition shadow-xs"
            >
              ปิดหน้าต่าง
            </button>
          )}
        </div>
      </div>

      {/* Discard Changes Confirmation Overlay */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ปิดโดยไม่บันทึกข้อมูล?</h3>
              <p className="text-xs text-slate-500 mt-1">
                มีการแก้ไขที่ยังไม่ได้บันทึก หากปิดตอนนี้การแก้ไขทั้งหมดจะหายไป
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                อยู่ต่อ
              </button>
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-sm"
              >
                ปิดโดยไม่บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Overlay */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ยืนยันการอนุมัติโครงการ</h3>
              <p className="text-xs text-slate-500 mt-1">
                ต้องการอนุมัติการดำเนินงาน &quot;{localRecord.projectName}&quot; ใช่หรือไม่?
                สถานะจะเปลี่ยนเป็น Approved และไปแสดงที่ Project Roadmap
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ไม่ใช่
              </button>
              <button
                onClick={handleConfirmApprove}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                ใช่, อนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Success Overlay */}
      {showApproveSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">อนุมัติและบันทึกสำเร็จ</h3>
              <p className="text-xs text-slate-500 mt-1">
                โครงการนี้ถูกอนุมัติแล้ว และจะแสดงที่หน้า Project Roadmap
              </p>
            </div>
            <button
              onClick={() => setShowApproveSuccess(false)}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
