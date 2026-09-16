"use client";

import { SavedRecord, PaymentStatus } from "@/lib/types";
import { getTotalWeeks, parseWeeksFromDuration } from "@/lib/timeframe-utils";
import { DEPARTMENT_OPTIONS, formatDepartmentLabel } from "@/lib/department-utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/payment-status-utils";
import { formatThousands, parseThousands } from "@/lib/format-utils";
import { DateInputDDMMYYYY } from "@/components/date-input-ddmmyyyy";
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
  XCircle,
  Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";

// Read-only badge — Admin now adjusts payment status from the Project
// Roadmap page instead of here.
const PAYMENT_STATUS_BADGE_STYLES: Record<PaymentStatus, string> = {
  wait: "bg-amber-50 border-amber-300 text-amber-900",
  invoice: "bg-sky-50 border-sky-300 text-sky-900",
  paid: "bg-emerald-50 border-emerald-300 text-emerald-900",
  hold: "bg-violet-50 border-violet-300 text-violet-900",
  cancelled: "bg-red-50 border-red-300 text-red-900",
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
  const [activeTab, setActiveTab] = useState<"all" | "payments" | "operations">("all");
  const [localRecord, setLocalRecord] = useState<SavedRecord | null>(record);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveSuccess, setShowApproveSuccess] = useState(false);
  const [showUnapproveConfirm, setShowUnapproveConfirm] = useState(false);
  const [showTotalFeeEdit, setShowTotalFeeEdit] = useState(false);
  const [pendingTotalFee, setPendingTotalFee] = useState(0);
  const [showTotalFeeConfirm, setShowTotalFeeConfirm] = useState(false);

  useEffect(() => {
    setLocalRecord(record);
    setIsDirty(false);
  }, [record]);

  if (!isOpen || !localRecord) return null;

  const totalWeeks = getTotalWeeks(localRecord.timeFrames || []);
  const paymentSum = (localRecord.paymentTerms || []).reduce((sum, pt) => sum + (Number(pt.amount) || 0), 0);
  const paymentSumExceedsFee = localRecord.totalFee > 0 && paymentSum > localRecord.totalFee;

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

  // Editing the Amount directly recomputes this milestone's % from it
  // (the inverse of editing %, which recomputes the Amount).
  const handleUpdatePaymentAmount = (idx: number, val: string) => {
    const amount = parseThousands(val);
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    updatedTerms[idx] = {
      ...updatedTerms[idx],
      amount,
      paymentPercentage: localRecord.totalFee > 0 ? (amount / localRecord.totalFee) * 100 : 0,
    };
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  const handleUpdateTimeframeDuration = (idx: number, weeks: string) => {
    const updatedFrames = [...(localRecord.timeFrames || [])];
    updatedFrames[idx] = { ...updatedFrames[idx], duration: `${weeks} Weeks` };
    setLocalRecord({ ...localRecord, timeFrames: updatedFrames });
    setIsDirty(true);
  };

  const handleUpdateTimeframeField = (idx: number, field: "phase" | "description", val: string) => {
    const updatedFrames = [...(localRecord.timeFrames || [])];
    updatedFrames[idx] = { ...updatedFrames[idx], [field]: val };
    setLocalRecord({ ...localRecord, timeFrames: updatedFrames });
    setIsDirty(true);
  };

  const handleUpdateMilestone = (idx: number, val: string) => {
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    updatedTerms[idx] = { ...updatedTerms[idx], milestone: val };
    setLocalRecord({ ...localRecord, paymentTerms: updatedTerms });
    setIsDirty(true);
  };

  // Total Fee edit flow: pencil -> edit modal -> Save opens a Yes/No
  // confirm -> Yes applies it to local state (still gated behind the
  // modal's own Save button below, same as every other field here).
  const handleOpenTotalFeeEdit = () => {
    setPendingTotalFee(localRecord.totalFee || 0);
    setShowTotalFeeEdit(true);
  };

  const handleConfirmTotalFeeEdit = () => {
    setLocalRecord({ ...localRecord, totalFee: pendingTotalFee });
    setIsDirty(true);
    setShowTotalFeeConfirm(false);
  };

  const handleOperationFieldChange = (field: "startDate" | "department", val: string) => {
    setLocalRecord({ ...localRecord, [field]: val });
    setIsDirty(true);
  };

  const handleConfirmSaveChanges = async () => {
    if (!localRecord) return;
    setShowSaveConfirm(false);
    setIsSaving(true);
    try {
      await onUpdate(localRecord);
      setIsDirty(false);
      setShowSaveSuccess(true);
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

  // Pulls an approved project back off the Project Roadmap.
  const handleConfirmUnapprove = async () => {
    const updated: SavedRecord = {
      ...localRecord,
      status: "verified",
      approvedAt: undefined,
    };
    setLocalRecord(updated);
    setShowUnapproveConfirm(false);
    setIsSaving(true);
    try {
      await onUpdate(updated);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
          {/* Section 1: General Info & Financial Summary */}
          {activeTab === "all" && (
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
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Total Fee:
                      <button
                        type="button"
                        onClick={handleOpenTotalFeeEdit}
                        title="แก้ไข Total Fee"
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </span>
                    <span className="text-base font-black font-mono text-indigo-900">
                      ฿{Number(localRecord.totalFee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Timeframes Table */}
          {activeTab === "all" && localRecord.timeFrames && localRecord.timeFrames.length > 0 && (
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
                      <th className="px-4 py-2.5 text-center w-32">ระยะเวลา (สัปดาห์)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localRecord.timeFrames.map((tf, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={tf.phase}
                            onChange={(e) => handleUpdateTimeframeField(idx, "phase", e.target.value)}
                            className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none transition"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={tf.description}
                            onChange={(e) => handleUpdateTimeframeField(idx, "description", e.target.value)}
                            className="w-full px-2 py-1 text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none transition"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={parseWeeksFromDuration(tf.duration)}
                              onChange={(e) => handleUpdateTimeframeDuration(idx, e.target.value)}
                              className="w-16 px-2 py-1 text-xs text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                            <span className="text-slate-500 font-medium text-[11px]">Weeks</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-bold">
                      <td colSpan={3} className="px-4 py-2.5 text-right text-slate-700">
                        รวมระยะเวลาทั้งหมด
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-indigo-700">{totalWeeks} Weeks</td>
                    </tr>
                  </tfoot>
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
                      <th className="px-4 py-2.5 text-right w-40">จำนวนเงิน (THB)</th>
                      <th className="px-4 py-2.5 text-center w-32">เก็บเงินสัปดาห์ที่</th>
                      <th className="px-4 py-2.5 text-center w-28">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localRecord.paymentTerms.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={pt.milestone}
                            onChange={(e) => handleUpdateMilestone(idx, e.target.value)}
                            className="w-full px-2 py-1 text-xs font-semibold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none transition"
                          />
                        </td>
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
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-emerald-700 font-mono font-bold text-[11px]">฿</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatThousands(pt.amount)}
                              onChange={(e) => handleUpdatePaymentAmount(idx, e.target.value)}
                              className="w-28 px-2 py-1 text-xs text-right font-mono font-bold text-emerald-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
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
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              PAYMENT_STATUS_BADGE_STYLES[pt.paymentStatus || "wait"]
                            }`}
                          >
                            {PAYMENT_STATUS_LABELS[pt.paymentStatus || "wait"]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t-2 font-bold ${paymentSumExceedsFee ? "border-red-300 bg-red-50/70" : "border-slate-200 bg-slate-50/70"}`}>
                      <td colSpan={3} className="px-4 py-2.5 text-right text-slate-700">
                        รวม
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${paymentSumExceedsFee ? "text-red-700" : "text-emerald-700"}`}>
                        ฿{formatThousands(paymentSum)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {paymentSumExceedsFee && (
                <div className="px-4 py-2.5 bg-red-50/90 border-t border-red-200 flex items-start gap-2 text-[11px] text-red-900 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <p>
                    ผลรวมจำนวนเงิน (฿{formatThousands(paymentSum)}) เกินกว่า Total Fee (฿{formatThousands(localRecord.totalFee)}) —
                    ต้องปรับให้ไม่เกินก่อนถึงจะบันทึกได้
                  </p>
                </div>
              )}
              <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500">
                สถานะแสดงผลอย่างเดียว — ปรับสถานะ (Wait / Invoice / Paid) ได้ที่หน้า Project Roadmap
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
                    <label className="text-[11px] font-bold text-slate-600">Start Date (DD/MM/YYYY)</label>
                    <DateInputDDMMYYYY
                      value={localRecord.startDate || ""}
                      onChange={(iso) => handleOperationFieldChange("startDate", iso)}
                      className="w-full px-3 py-2 pr-8 text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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
                          {formatDepartmentLabel(dept)}
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
                  {localRecord.status === "approved" ? (
                    <button
                      onClick={() => setShowUnapproveConfirm(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Not Approved
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowApproveConfirm(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  )}
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
              onClick={() => setShowSaveConfirm(true)}
              disabled={isSaving || paymentSumExceedsFee}
              title={paymentSumExceedsFee ? "ผลรวมจำนวนเงินเกิน Total Fee — ต้องปรับก่อนบันทึก" : undefined}
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

      {/* Save Confirmation Overlay */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ยืนยันการบันทึกข้อมูล</h3>
              <p className="text-xs text-slate-500 mt-1">
                ต้องการบันทึกการแก้ไขทั้งหมดใน &quot;{localRecord.projectName}&quot; ใช่หรือไม่?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ไม่ใช่
              </button>
              <button
                onClick={handleConfirmSaveChanges}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                ใช่, บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Success Overlay */}
      {showSaveSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">บันทึกข้อมูลสำเร็จ</h3>
              <p className="text-xs text-slate-500 mt-1">การแก้ไขทั้งหมดถูกบันทึกเรียบร้อยแล้ว</p>
            </div>
            <button
              onClick={() => setShowSaveSuccess(false)}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition shadow-sm"
            >
              ตกลง
            </button>
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

      {/* Unapprove Confirmation Overlay */}
      {showUnapproveConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ยืนยันการยกเลิกอนุมัติ</h3>
              <p className="text-xs text-slate-500 mt-1">
                ต้องการยกเลิกการอนุมัติ &quot;{localRecord.projectName}&quot; ใช่หรือไม่?
                โครงการจะถูกดึงออกจาก Project Roadmap ทันที
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowUnapproveConfirm(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmUnapprove}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-sm"
              >
                ใช่, ยกเลิกอนุมัติ
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

      {/* Total Fee Edit Overlay */}
      {showTotalFeeEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">แก้ไข Total Fee</h3>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Total Fee (THB)</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={formatThousands(pendingTotalFee)}
                onChange={(e) => setPendingTotalFee(parseThousands(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2.5 text-base font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowTotalFeeEdit(false)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowTotalFeeEdit(false);
                  setShowTotalFeeConfirm(true);
                }}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total Fee Confirm Overlay */}
      {showTotalFeeConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ยืนยันการแก้ไข Total Fee</h3>
              <p className="text-xs text-slate-500 mt-1">
                ต้องการเปลี่ยน Total Fee เป็น{" "}
                <span className="font-bold text-slate-800">฿{formatThousands(pendingTotalFee)}</span> ใช่หรือไม่?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowTotalFeeConfirm(false);
                  setShowTotalFeeEdit(true);
                }}
                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ไม่ใช่
              </button>
              <button
                onClick={handleConfirmTotalFeeEdit}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                ใช่, บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
