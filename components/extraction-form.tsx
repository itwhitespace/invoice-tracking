"use client";

import { useEffect, useMemo } from "react";
import {
  ExtractedProjectData,
  DesignFeeItem,
  TimeFrameItem,
  PaymentTermItem,
} from "@/lib/types";
import { getTotalWeeks } from "@/lib/timeframe-utils";
import {
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Layers,
  Calendar,
  Clock,
  CreditCard,
  FileSpreadsheet,
} from "lucide-react";

interface ExtractionFormProps {
  data: ExtractedProjectData;
  onChange: (data: ExtractedProjectData) => void;
  isAiExtracted?: boolean;
  isDemoFallback?: boolean;
}

export function ExtractionForm({ data, onChange, isAiExtracted, isDemoFallback }: ExtractionFormProps) {
  // Calculations
  const designFeeItems = data.designFeeItems || [];

  const sumOfDesignFeeItems = useMemo(() => {
    return designFeeItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [designFeeItems]);

  const specialDiscount = Number(data.specialDiscount) || 0;
  const totalFeeComputed = Math.max(sumOfDesignFeeItems - specialDiscount, 0);
  const vatAmount = totalFeeComputed * 0.07;
  const grandTotal = totalFeeComputed + vatAmount;

  // Keep the stored totalFee in sync with the auto-calculated Sub Total - Discount
  useEffect(() => {
    if (data.totalFee !== totalFeeComputed) {
      onChange({ ...data, totalFee: totalFeeComputed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFeeComputed]);

  const paymentPercentagesKey = data.paymentTerms.map((t) => t.paymentPercentage).join(",");

  // Keep every milestone's Amount (THB) auto-calculated from Total Fee x Payment %
  useEffect(() => {
    if (data.paymentTerms.length === 0) return;
    const recalculated = data.paymentTerms.map((term) => ({
      ...term,
      amount: Math.round((data.totalFee * (term.paymentPercentage || 0)) / 100),
    }));
    const hasChanged = recalculated.some(
      (term, i) => term.amount !== data.paymentTerms[i].amount
    );
    if (hasChanged) {
      onChange({ ...data, paymentTerms: recalculated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.totalFee, paymentPercentagesKey]);

  const totalPercentage = useMemo(() => {
    return data.paymentTerms.reduce(
      (sum, item) => sum + (Number(item.paymentPercentage) || 0),
      0
    );
  }, [data.paymentTerms]);

  const totalCalculatedAmount = useMemo(() => {
    return data.paymentTerms.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [data.paymentTerms]);

  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01;
  const isAmountMatching = Math.abs(totalCalculatedAmount - Number(data.totalFee || 0)) < 1;

  const totalWeeks = useMemo(() => getTotalWeeks(data.timeFrames), [data.timeFrames]);

  // Handlers for Project Brief
  const handleFieldChange = (field: keyof ExtractedProjectData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  // Handlers for Design Fee Items Breakdown Table
  const handleAddDesignFeeItem = () => {
    const nextItemNumber = designFeeItems.length + 1;
    const newItem: DesignFeeItem = {
      item: `Scope / Stage ${nextItemNumber}`,
      description: "",
      amount: 0,
    };
    onChange({
      ...data,
      designFeeItems: [...designFeeItems, newItem],
    });
  };

  const handleUpdateDesignFeeItem = (
    index: number,
    field: keyof DesignFeeItem,
    val: string | number
  ) => {
    const updated = [...designFeeItems];
    const current = { ...updated[index] };
    if (field === "amount") {
      current.amount = parseFloat(val.toString()) || 0;
    } else {
      (current as any)[field] = val;
    }
    updated[index] = current;
    onChange({ ...data, designFeeItems: updated });
  };

  const handleDeleteDesignFeeItem = (index: number) => {
    const updated = designFeeItems.filter((_, i) => i !== index);
    onChange({ ...data, designFeeItems: updated });
  };

  // Handlers for TimeFrame Items
  const handleAddTimeFrame = () => {
    const nextPhaseNumber = data.timeFrames.length + 1;
    const newItem: TimeFrameItem = {
      phase: `Phase ${nextPhaseNumber}: `,
      description: "",
      duration: "2 Weeks",
    };
    onChange({
      ...data,
      timeFrames: [...data.timeFrames, newItem],
    });
  };

  const handleUpdateTimeFrame = (index: number, field: keyof TimeFrameItem, val: string) => {
    const updated = [...data.timeFrames];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...data, timeFrames: updated });
  };

  const handleDeleteTimeFrame = (index: number) => {
    const updated = data.timeFrames.filter((_, i) => i !== index);
    onChange({ ...data, timeFrames: updated });
  };

  // Handlers for Payment Term Items
  const handleAddPaymentTerm = () => {
    const nextIndex = data.paymentTerms.length + 1;
    const newItem: PaymentTermItem = {
      milestone: `Installment ${nextIndex}: `,
      paymentPercentage: 0,
      amount: 0,
    };
    onChange({
      ...data,
      paymentTerms: [...data.paymentTerms, newItem],
    });
  };

  const handleUpdatePaymentTerm = (
    index: number,
    field: "milestone" | "paymentPercentage" | "paymentWeek",
    val: string
  ) => {
    const updated = [...data.paymentTerms];
    const current = { ...updated[index] };

    if (field === "paymentPercentage") {
      const pct = parseFloat(val) || 0;
      current.paymentPercentage = pct;
      current.amount = Math.round((data.totalFee * pct) / 100);
    } else if (field === "paymentWeek") {
      current.paymentWeek = val ? parseInt(val, 10) : undefined;
    } else {
      current.milestone = val;
    }

    updated[index] = current;
    onChange({ ...data, paymentTerms: updated });
  };

  const handleDeletePaymentTerm = (index: number) => {
    const updated = data.paymentTerms.filter((_, i) => i !== index);
    onChange({ ...data, paymentTerms: updated });
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 bg-white space-y-8">
      {/* Header Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-black tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-black" />
            ตรวจสอบและแก้ไขข้อมูล (Verification Form)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            คุณสามารถปรับแก้ตัวเลข ข้อความ หรือเพิ่ม/ลบแถวตารางก่อนกดบันทึกลงระบบ
          </p>
        </div>

        {isDemoFallback ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-full shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Demo Data (No API Key)
          </span>
        ) : (
          isAiExtracted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              AI Extracted
            </span>
          )
        )}
      </div>

      {/* Issuing Company (shown above section 1) */}
      <div className="flex items-center gap-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg px-3.5 py-2.5">
        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
        <label className="text-xs font-bold text-indigo-900 shrink-0">บริษัทผู้ออกเอกสาร:</label>
        <select
          value={data.companyName || ""}
          onChange={(e) => handleFieldChange("companyName", e.target.value)}
          className="flex-1 max-w-xs px-2.5 py-1.5 text-xs font-semibold text-indigo-950 bg-white border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        >
          <option value="">— ยังไม่ระบุ —</option>
          <option value="Whitespace Partners">Whitespace Partners</option>
          <option value="Whitespaceconnect">Whitespaceconnect</option>
        </select>
      </div>

      {/* 1. Project Brief & Information */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-black">
          <Layers className="w-4 h-4 text-black" />
          <span>1. Project Brief & Details</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black">Project Name *</label>
            <input
              type="text"
              value={data.projectName}
              onChange={(e) => handleFieldChange("projectName", e.target.value)}
              placeholder="เช่น Street Burger at Petit Phuket"
              className="w-full px-3 py-2 text-xs font-medium text-black bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black">Area / Size / Location</label>
            <input
              type="text"
              value={data.area}
              onChange={(e) => handleFieldChange("area", e.target.value)}
              placeholder="เช่น Approx. 149 sq.m."
              className="w-full px-3 py-2 text-xs font-medium text-black bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-black">Scope of Work</label>
          <textarea
            rows={3}
            value={data.scopeOfWork}
            onChange={(e) => handleFieldChange("scopeOfWork", e.target.value)}
            placeholder="รายละเอียดขอบเขตงาน..."
            className="w-full px-3 py-2 text-xs font-medium text-black bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition leading-relaxed"
          />
        </div>
      </section>

      {/* 2. Design Fees (Full Table + Auto-Calculated Summary) */}
      <section className="space-y-3">
        <div className="flex justify-between items-center pb-1">
          <div className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-black">
            <CreditCard className="w-4 h-4 text-black" />
            <span>2. Design Fees</span>
          </div>

          <button
            onClick={handleAddDesignFeeItem}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-black bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มรายการ Fee
          </button>
        </div>

        {/* Breakdown Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-sky-50/90 text-sky-950 font-bold border-b border-sky-200">
              <tr>
                <th className="p-2.5 w-44">Scope / Item Description</th>
                <th className="p-2.5">Deliverable Notes & Conditions</th>
                <th className="p-2.5 w-36 text-right">Fee Amount (THB)</th>
                <th className="p-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {designFeeItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-slate-500 text-xs">
                    ไม่มีรายการแยกย่อย (กดปุ่ม &quot;เพิ่มรายการ Fee&quot; เพื่อเพิ่มแถว)
                  </td>
                </tr>
              ) : (
                designFeeItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.item}
                        onChange={(e) => handleUpdateDesignFeeItem(idx, "item", e.target.value)}
                        placeholder="Interior Design Stages 1-4"
                        className="w-full px-2 py-1.5 text-xs text-black font-semibold bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateDesignFeeItem(idx, "description", e.target.value)
                        }
                        placeholder="Perspective 3D renderings, BOQ & coordination"
                        className="w-full px-2 py-1.5 text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        value={item.amount || ""}
                        onChange={(e) =>
                          handleUpdateDesignFeeItem(idx, "amount", e.target.value)
                        }
                        placeholder="0"
                        className="w-full px-2 py-1.5 text-xs text-right font-mono font-bold text-black bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeleteDesignFeeItem(idx)}
                        title="ลบรายการนี้"
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

        {/* Auto-Calculated Summary: Sub Total, Discount, Total Fee, VAT, Grand Total */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-right">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="p-2.5 text-left font-semibold text-slate-700">Sub Total Fee</td>
                <td className="p-2.5 w-44 font-mono font-bold text-black">
                  {sumOfDesignFeeItems.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="p-2.5 text-left font-semibold text-slate-700">Special discount</td>
                <td className="p-2 w-44">
                  <input
                    type="number"
                    value={data.specialDiscount || ""}
                    onChange={(e) =>
                      handleFieldChange("specialDiscount", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-xs text-right font-mono font-bold text-black bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                  />
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="p-2.5 text-left font-semibold text-slate-700">Total Fee</td>
                <td className="p-2.5 font-mono font-bold text-black">
                  {totalFeeComputed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="p-2.5 text-left font-semibold text-slate-700">VAT 7%</td>
                <td className="p-2.5 font-mono font-bold text-black">
                  {vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-amber-50/90">
                <td className="p-2.5 text-left font-bold text-amber-950 uppercase tracking-wide text-[11px]">
                  ★ Grand Total (THB)
                </td>
                <td className="p-2.5 font-mono font-black text-amber-950 text-sm">
                  {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Estimated Time Frame */}
      <section className="space-y-3">
        <div className="flex justify-between items-center pb-1">
          <div className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-black">
            <Calendar className="w-4 h-4 text-black" />
            <span>3. Estimated Time Frame ({data.timeFrames.length} Phases)</span>
          </div>

          <button
            onClick={handleAddTimeFrame}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-black bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่ม Phase
          </button>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-sky-50/90 text-sky-950 font-bold border-b border-sky-200">
              <tr>
                <th className="p-2.5 w-44">Phase Title</th>
                <th className="p-2.5">Deliverables / Description</th>
                <th className="p-2.5 w-32 text-right">Duration</th>
                <th className="p-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.timeFrames.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500 text-xs">
                    ยังไม่มีข้อมูล Time Frame (กดปุ่ม &quot;เพิ่ม Phase&quot; เพื่อเพิ่มแถว)
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
                        className="w-full px-2 py-1.5 text-xs text-black font-semibold bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
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
                        className="w-full px-2 py-1.5 text-xs text-right font-mono font-semibold text-black bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
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

        {/* Total Design Duration Summary (not a table row) */}
        <div className="bg-amber-50/90 border-2 border-amber-300/90 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-900 shrink-0">
              <Clock className="w-5 h-5 text-amber-900" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-amber-950 block">
                ★ Total Design Duration
              </span>
              <span className="text-[11px] text-amber-900 font-medium">
                ระยะเวลาดำเนินงานโดยรวมทั้งโครงการ
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <input
              type="text"
              value={data.totalDesignDuration || ""}
              onChange={(e) => handleFieldChange("totalDesignDuration", e.target.value)}
              placeholder="เช่น 16 Weeks"
              className="w-full sm:w-56 px-3 py-2 text-lg font-black font-mono text-amber-950 bg-white border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-inner"
            />
          </div>
        </div>
      </section>

      {/* 4. Payment Term & Milestone Schedule */}
      <section className="space-y-3">
        <div className="flex justify-between items-center pb-1">
          <div className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-black">
            <CreditCard className="w-4 h-4 text-black" />
            <span>4. Payment Term & Milestone Schedule</span>
          </div>

          <button
            onClick={handleAddPaymentTerm}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-black bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่ม Milestone
          </button>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-sky-50/90 text-sky-950 font-bold border-b border-sky-200">
              <tr>
                <th className="p-2.5">Milestone / Term</th>
                <th className="p-2.5 w-28 text-right">Payment %</th>
                <th className="p-2.5 w-32 text-center">เก็บเงินสัปดาห์ที่</th>
                <th className="p-2.5 w-36 text-right">Amount (THB)</th>
                <th className="p-2.5 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.paymentTerms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 text-xs">
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
                        onChange={(e) => handleUpdatePaymentTerm(idx, "milestone", e.target.value)}
                        placeholder="งวดที่ 1: เซ็นสัญญา"
                        className="w-full px-2 py-1.5 text-xs text-black font-semibold bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          value={item.paymentPercentage}
                          onChange={(e) =>
                            handleUpdatePaymentTerm(idx, "paymentPercentage", e.target.value)
                          }
                          className="w-16 px-2 py-1.5 text-xs text-right font-mono font-bold text-black bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded outline-none"
                        />
                        <span className="text-slate-600 font-mono font-bold">%</span>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <select
                        value={item.paymentWeek ?? ""}
                        onChange={(e) => handleUpdatePaymentTerm(idx, "paymentWeek", e.target.value)}
                        disabled={totalWeeks === 0}
                        title={
                          totalWeeks === 0
                            ? "กรอกข้อมูลตาราง Time Frame (หัวข้อ 3) ก่อน เพื่อให้ระบบรู้จำนวนสัปดาห์ทั้งหมด"
                            : undefined
                        }
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-semibold text-black bg-transparent border border-slate-200 rounded outline-none focus:bg-white focus:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">- ยังไม่ระบุ -</option>
                        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                          <option key={w} value={w}>
                            Week {w}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <span className="block w-full px-2 py-1.5 text-xs text-right font-mono font-bold text-black">
                        {(item.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
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
            {/* Table Footer Summary */}
            <tfoot className="bg-sky-50/80 font-bold border-t border-sky-200 text-black">
              <tr>
                <td className="p-2.5 text-right font-bold text-slate-800">Total Calculation:</td>
                <td className="p-2.5 text-right font-mono">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      isPercentageValid
                        ? "text-emerald-800 bg-emerald-100 border border-emerald-300 font-bold"
                        : "text-amber-900 bg-amber-200 border border-amber-400 font-black"
                    }`}
                  >
                    {totalPercentage.toFixed(1)}%
                  </span>
                </td>
                <td></td>
                <td className="p-2.5 text-right font-mono text-sm">
                  <span
                    className={
                      isAmountMatching ? "text-black font-black" : "text-amber-800 font-black"
                    }
                  >
                    {totalCalculatedAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Validation Warning Notice if not balanced */}
        {(!isPercentageValid || !isAmountMatching) && (
          <div className="flex items-start gap-2 p-3 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-950 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              {!isPercentageValid && (
                <p>
                  ผลรวมเปอร์เซ็นต์เท่ากับ <strong>{totalPercentage}%</strong> (ควรเท่ากับ 100%)
                </p>
              )}
              {!isAmountMatching && data.totalFee > 0 && (
                <p>
                  ผลรวมยอดเงินงวด (THB {totalCalculatedAmount.toLocaleString()}) ไม่ตรงกับ Total Fee
                  (THB {data.totalFee.toLocaleString()})
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
