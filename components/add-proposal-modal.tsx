"use client";

import { useState } from "react";
import { ExtractedProjectData, TimeFrameItem, PaymentTermItem } from "@/lib/types";
import { getTotalWeeks } from "@/lib/timeframe-utils";
import {
  X,
  Plus,
  Trash2,
  Building2,
  Layers,
  Calendar,
  CreditCard,
  Percent,
  Loader2,
  Save,
  AlertCircle,
  FilePlus,
} from "lucide-react";

const EMPTY_DATA: ExtractedProjectData = {
  companyName: "",
  projectName: "",
  totalFee: 0,
  timeFrames: [],
  totalDesignDuration: "",
  paymentTerms: [],
};

interface AddProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: ExtractedProjectData) => Promise<void>;
}

export function AddProposalModal({ isOpen, onClose, onCreate }: AddProposalModalProps) {
  const [data, setData] = useState<ExtractedProjectData>(EMPTY_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  if (!isOpen) return null;

  const totalWeeks = getTotalWeeks(data.timeFrames);

  const handleFieldChange = (field: keyof ExtractedProjectData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  // Handlers for TimeFrame Items
  const handleAddTimeFrame = () => {
    const nextPhaseNumber = data.timeFrames.length + 1;
    const newItem: TimeFrameItem = {
      phase: `Phase ${nextPhaseNumber}: `,
      description: "",
      duration: "2 Weeks",
    };
    setData((prev) => ({ ...prev, timeFrames: [...prev.timeFrames, newItem] }));
  };

  const handleUpdateTimeFrame = (index: number, field: keyof TimeFrameItem, val: string) => {
    setData((prev) => {
      const updated = [...prev.timeFrames];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, timeFrames: updated };
    });
  };

  const handleDeleteTimeFrame = (index: number) => {
    setData((prev) => ({ ...prev, timeFrames: prev.timeFrames.filter((_, i) => i !== index) }));
  };

  // Handlers for Payment Term Items
  const handleAddPaymentTerm = () => {
    const nextIndex = data.paymentTerms.length + 1;
    const newItem: PaymentTermItem = {
      milestone: `Installment ${nextIndex}: `,
      paymentPercentage: 0,
      amount: 0,
    };
    setData((prev) => ({ ...prev, paymentTerms: [...prev.paymentTerms, newItem] }));
  };

  const handleUpdatePaymentPercentage = (index: number, val: string) => {
    const pct = parseFloat(val) || 0;
    setData((prev) => {
      const updated = [...prev.paymentTerms];
      updated[index] = { ...updated[index], paymentPercentage: pct, amount: Math.round((prev.totalFee * pct) / 100) };
      return { ...prev, paymentTerms: updated };
    });
  };

  const handleUpdatePaymentAmount = (index: number, val: string) => {
    const amount = parseFloat(val) || 0;
    setData((prev) => {
      const updated = [...prev.paymentTerms];
      updated[index] = {
        ...updated[index],
        amount,
        paymentPercentage: prev.totalFee > 0 ? (amount / prev.totalFee) * 100 : 0,
      };
      return { ...prev, paymentTerms: updated };
    });
  };

  const handleUpdatePaymentWeek = (index: number, val: string) => {
    setData((prev) => {
      const updated = [...prev.paymentTerms];
      updated[index] = { ...updated[index], paymentWeek: val ? parseInt(val, 10) : undefined };
      return { ...prev, paymentTerms: updated };
    });
  };

  const handleDeletePaymentTerm = (index: number) => {
    setData((prev) => ({ ...prev, paymentTerms: prev.paymentTerms.filter((_, i) => i !== index) }));
  };

  const isValid = !!data.companyName && !!data.projectName.trim() && data.totalFee > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      setShowValidation(true);
      return;
    }
    setIsSaving(true);
    try {
      await onCreate(data);
      setData(EMPTY_DATA);
      setShowValidation(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setData(EMPTY_DATA);
    setShowValidation(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">เพิ่ม Proposal (คีย์ข้อมูลเอง)</h2>
              <p className="text-[11px] text-slate-500">กรอกข้อมูลโครงการโดยไม่ต้องอัปโหลด PDF</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Company + Project Name */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Layers className="w-3.5 h-3.5" />
              <span>ข้อมูลโครงการ</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  บริษัทผู้ออกเอกสาร (Company) *
                </label>
                <select
                  value={data.companyName || ""}
                  onChange={(e) => handleFieldChange("companyName", e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition ${
                    showValidation && !data.companyName ? "border-red-300" : "border-slate-300"
                  }`}
                >
                  <option value="">— ยังไม่ระบุ —</option>
                  <option value="Whitespace Partners">Whitespace Partners</option>
                  <option value="Whitespaceconnect">Whitespaceconnect</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ชื่อโครงการ (Project Name) *</label>
                <input
                  type="text"
                  value={data.projectName}
                  onChange={(e) => handleFieldChange("projectName", e.target.value)}
                  placeholder="เช่น Street Burger at Petit Phuket"
                  className={`w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition ${
                    showValidation && !data.projectName.trim() ? "border-red-300" : "border-slate-300"
                  }`}
                />
              </div>
            </div>
          </section>

          {/* Total Fee */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <CreditCard className="w-3.5 h-3.5" />
              <span>ค่าบริการ</span>
            </div>
            <div className="space-y-1.5 max-w-xs">
              <label className="text-xs font-bold text-slate-700">Total Fee (THB) *</label>
              <input
                type="number"
                value={data.totalFee || ""}
                onChange={(e) => handleFieldChange("totalFee", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className={`w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition ${
                  showValidation && data.totalFee <= 0 ? "border-red-300" : "border-slate-300"
                }`}
              />
            </div>
          </section>

          {/* Timeframes */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Calendar className="w-3.5 h-3.5" />
                <span>ขั้นตอนและระยะเวลาดำเนินงาน (Project Timeframes)</span>
              </div>
              <button
                onClick={handleAddTimeFrame}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่ม Phase
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                  <tr>
                    <th className="p-2.5 w-44">ระยะงาน (Phase)</th>
                    <th className="p-2.5">รายละเอียดงาน (Description)</th>
                    <th className="p-2.5 w-32 text-right">ระยะเวลา (Duration)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.timeFrames.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">
                        ยังไม่มีข้อมูล (กดปุ่ม &quot;เพิ่ม Phase&quot; เพื่อเพิ่มแถว)
                      </td>
                    </tr>
                  ) : (
                    data.timeFrames.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.phase}
                            onChange={(e) => handleUpdateTimeFrame(idx, "phase", e.target.value)}
                            placeholder="Phase 1: Concept"
                            className="w-full px-2 py-1.5 text-xs text-slate-900 font-semibold bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateTimeFrame(idx, "description", e.target.value)}
                            placeholder="รายละเอียดงาน"
                            className="w-full px-2 py-1.5 text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="text"
                            value={item.duration}
                            onChange={(e) => handleUpdateTimeFrame(idx, "duration", e.target.value)}
                            placeholder="4 Weeks"
                            className="w-full px-2 py-1.5 text-xs text-right font-mono font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteTimeFrame(idx)}
                            title="ลบแถวนี้"
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 max-w-xs">
              <label className="text-[11px] font-semibold text-slate-500">ระยะเวลารวม (Total Design Duration)</label>
              <input
                type="text"
                value={data.totalDesignDuration || ""}
                onChange={(e) => handleFieldChange("totalDesignDuration", e.target.value)}
                placeholder="เช่น 16 Weeks"
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </section>

          {/* Payment Terms */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Percent className="w-3.5 h-3.5" />
                <span>เงื่อนไขและการแบ่งจ่ายเงิน (Payment Terms)</span>
              </div>
              <button
                onClick={handleAddPaymentTerm}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่ม Milestone
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                  <tr>
                    <th className="p-2.5">เงื่อนไขงวดงาน (Milestone)</th>
                    <th className="p-2.5 w-24 text-center">สัดส่วน (%)</th>
                    <th className="p-2.5 w-36 text-right">จำนวนเงิน (THB)</th>
                    <th className="p-2.5 w-32 text-center">เก็บเงินสัปดาห์ที่</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.paymentTerms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 text-xs">
                        ยังไม่มีรายการงวดการจ่ายเงิน
                      </td>
                    </tr>
                  ) : (
                    data.paymentTerms.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.milestone}
                            onChange={(e) =>
                              setData((prev) => {
                                const updated = [...prev.paymentTerms];
                                updated[idx] = { ...updated[idx], milestone: e.target.value };
                                return { ...prev, paymentTerms: updated };
                              })
                            }
                            placeholder="งวดที่ 1: เซ็นสัญญา"
                            className="w-full px-2 py-1.5 text-xs text-slate-900 font-semibold bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={item.paymentPercentage}
                              onChange={(e) => handleUpdatePaymentPercentage(idx, e.target.value)}
                              className="w-16 px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                            />
                            <span className="text-slate-500 font-mono font-bold">%</span>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={item.amount || ""}
                            onChange={(e) => handleUpdatePaymentAmount(idx, e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 text-xs text-right font-mono font-bold text-emerald-700 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <select
                            value={item.paymentWeek ?? ""}
                            onChange={(e) => handleUpdatePaymentWeek(idx, e.target.value)}
                            disabled={totalWeeks === 0}
                            title={totalWeeks === 0 ? "กรอกข้อมูล Timeframe ก่อน เพื่อให้ระบบรู้จำนวนสัปดาห์ทั้งหมด" : undefined}
                            className="w-full px-2 py-1.5 text-xs text-center font-mono font-semibold text-slate-800 bg-transparent border border-slate-200 rounded outline-none focus:bg-white focus:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">- ยังไม่ระบุ -</option>
                            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                              <option key={w} value={w}>
                                Week {w}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeletePaymentTerm(idx)}
                            title="ลบงวดนี้"
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showValidation && !isValid && (
            <div className="flex items-start gap-2 p-3 bg-red-50/90 border border-red-300 rounded-lg text-xs text-red-900 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>กรุณากรอกบริษัทผู้ออกเอกสาร, ชื่อโครงการ และ Total Fee ให้ครบก่อนบันทึก</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            บันทึก Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
