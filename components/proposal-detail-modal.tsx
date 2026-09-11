"use client";

import { SavedRecord, Department } from "@/lib/types";
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

interface ProposalDetailModalProps {
  isOpen: boolean;
  record: SavedRecord | null;
  onClose: () => void;
  onOpenPdf?: (record: SavedRecord) => void;
  onUpdate: (record: SavedRecord) => void;
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

  useEffect(() => {
    setLocalRecord(record);
  }, [record]);

  if (!isOpen || !localRecord) return null;

  const vatAmount = (localRecord.totalFee || 0) * 0.07;
  const grandTotal = (localRecord.totalFee || 0) + vatAmount;

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

  const handleUpdatePaymentPercentage = (idx: number, val: string) => {
    const pct = parseFloat(val) || 0;
    const updatedTerms = [...(localRecord.paymentTerms || [])];
    updatedTerms[idx] = {
      ...updatedTerms[idx],
      paymentPercentage: pct,
      amount: Math.round((localRecord.totalFee * pct) / 100),
    };
    const updated = { ...localRecord, paymentTerms: updatedTerms };
    setLocalRecord(updated);
    onUpdate(updated);
  };

  const handleOperationFieldChange = (field: "startDate" | "department", val: string) => {
    const updated = { ...localRecord, [field]: val };
    setLocalRecord(updated);
    onUpdate(updated);
  };

  const handleApprove = () => {
    const updated: SavedRecord = {
      ...localRecord,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };
    setLocalRecord(updated);
    onUpdate(updated);
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

          <div className="flex items-center gap-2">
            {localRecord.pdfUrl && onOpenPdf && (
              <button
                onClick={() => onOpenPdf(localRecord)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-2xs transition"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                ดูไฟล์ PDF
              </button>
            )}
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-2xs transition"
              title="ส่งออกเป็น JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              JSON
            </button>
            <button
              onClick={onClose}
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
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          ฿{Number(pt.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500">
                แก้ไข % แล้วจำนวนเงินจะคำนวณให้อัตโนมัติ และบันทึกเก็บไว้ทันที
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
                    onClick={handleApprove}
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
          <div className="text-[11px] text-slate-500">
            ID: <span className="font-mono font-semibold text-slate-700">{localRecord.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition shadow-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
