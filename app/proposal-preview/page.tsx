"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { ExtractedProjectData, SavedRecord } from "@/lib/types";
import {
  getSupabaseClient,
  getSavedRecords,
  saveRecordLocally,
  deleteRecordLocally,
  updateRecordRemote,
  deleteRecordRemote,
  insertProjectRemote,
  isRemoteId,
} from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { getCompanyLabel } from "@/lib/company-utils";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";
import { ProposalDetailModal } from "@/components/proposal-detail-modal";
import { AddProposalModal } from "@/components/add-proposal-modal";
import { FileSearch, Eye, Trash2, FileText, ExternalLink, FilePlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  verified: "bg-sky-100 text-sky-800 border-sky-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function ProposalPreviewPage() {
  return (
    <Suspense fallback={null}>
      <ProposalPreviewContent />
    </Suspense>
  );
}

function ProposalPreviewContent() {
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const companyFilter = searchParams.get("company") || "";
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewPdfRecord, setPreviewPdfRecord] = useState<SavedRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<SavedRecord | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filteredRecords = useMemo(() => {
    return companyFilter ? records.filter((r) => r.companyName === companyFilter) : records;
  }, [records, companyFilter]);

  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    getSavedRecords(supabase)
      .then(setRecords)
      .finally(() => setIsLoading(false));
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) return;

    deleteRecordLocally(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));

    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    if (supabase && isRemoteId(id)) {
      const { error } = await deleteRecordRemote(supabase, id);
      if (error) {
        window.alert("ลบข้อมูลใน Local History แล้ว แต่ลบใน Supabase ไม่สำเร็จ: " + error);
      }
    }
  };

  // Manual "Add Proposal" — same Supabase insert path as the PDF-upload
  // flow (via the shared insertProjectRemote helper), just without a file.
  const handleCreateProposal = async (data: ExtractedProjectData) => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    let remoteProjectId = "";

    if (supabase) {
      const { projectId, error } = await insertProjectRemote(supabase, {
        companyName: data.companyName || "",
        projectName: data.projectName,
        totalFee: data.totalFee,
        totalDesignDuration: data.totalDesignDuration || "",
        pdfUrl: "",
        pdfFileName: "",
        status: "verified",
        timeFrames: data.timeFrames,
        paymentTerms: data.paymentTerms,
      });
      if (error) {
        window.alert("บันทึกขึ้น Supabase ไม่สำเร็จ: " + error + "\nบันทึกไว้ใน Local History แทน");
      } else if (projectId) {
        remoteProjectId = projectId;
      }
    }

    const newRecord: SavedRecord = {
      id: remoteProjectId || `rec_${Date.now()}`,
      created_at: new Date().toISOString(),
      companyName: data.companyName || "",
      projectName: data.projectName,
      totalFee: data.totalFee,
      timeFrames: [...data.timeFrames],
      totalDesignDuration: data.totalDesignDuration || "",
      paymentTerms: [...data.paymentTerms],
      pdfFileName: "",
      pdfUrl: "",
      status: "verified",
    };

    const updatedRecords = saveRecordLocally(newRecord);
    setRecords(updatedRecords);
    setIsAddOpen(false);
  };

  const handleUpdateRecord = async (updated: SavedRecord) => {
    setDetailRecord(updated);
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    saveRecordLocally(updated);

    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    if (supabase && isRemoteId(updated.id)) {
      const { error } = await updateRecordRemote(supabase, updated);
      if (error) {
        window.alert("บันทึกใน Local History แล้ว แต่อัปเดตขึ้น Supabase ไม่สำเร็จ: " + error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-slate-700" />
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Proposal Preview</h1>
          {companyFilter && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              {getCompanyLabel(companyFilter)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">{filteredRecords.length} รายการ</span>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
          >
            <FilePlus className="w-3.5 h-3.5" />
            เพิ่ม Proposal
          </button>
          <Link
            href="/upload-proposal"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            ไปหน้า Upload
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <FileSearch className="w-10 h-10 animate-pulse" />
            <p className="text-xs font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <FileSearch className="w-10 h-10" />
            <p className="text-xs font-medium">
              {companyFilter
                ? `ยังไม่มีรายการของ "${getCompanyLabel(companyFilter)}"`
                : "ยังไม่มีรายการที่บันทึกไว้"}
            </p>
            <p className="text-[11px] text-slate-400">
              บันทึกข้อมูลจากหน้า Upload Proposal เพื่อให้แสดงที่นี่
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Project Name</th>
                    <th className="p-3.5">Project by</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5 text-right">Total Fee (THB)</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">วันที่บันทึก</th>
                    <th className="p-3.5">Approve Date</th>
                    <th className="p-3.5 text-center">Action (ดูข้อมูล)</th>
                    <th className="p-3.5 w-16 text-center">PDF</th>
                    <th className="p-3.5 w-16 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => setDetailRecord(rec)}
                    >
                      <td className="p-3.5 font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {rec.projectName}
                      </td>
                      <td className="p-3.5 text-slate-600">{rec.companyName || "-"}</td>
                      <td className="p-3.5 text-slate-600">{rec.totalDesignDuration || "-"}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                        {Number(rec.totalFee).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                            STATUS_STYLES[rec.status] || STATUS_STYLES.pending
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(rec.created_at).toLocaleString("th-TH")}
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {rec.approvedAt ? new Date(rec.approvedAt).toLocaleString("th-TH") : "-"}
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDetailRecord(rec)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-md transition flex items-center gap-1.5 mx-auto"
                          title="ดูข้อมูลที่บันทึกไว้ทั้งหมด"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>ดูรายละเอียด</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setPreviewPdfRecord(rec)}
                          title="Preview ไฟล์ PDF"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          title="ลบรายการนี้"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal แสดงข้อมูลที่บันทึกไว้ทั้งหมด */}
      <ProposalDetailModal
        isOpen={!!detailRecord}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onOpenPdf={(rec) => {
          setDetailRecord(null);
          setPreviewPdfRecord(rec);
        }}
        onUpdate={handleUpdateRecord}
      />

      {/* Modal Preview ไฟล์ PDF */}
      <PdfPreviewModal
        isOpen={!!previewPdfRecord}
        pdfUrl={previewPdfRecord?.pdfUrl || null}
        title={previewPdfRecord?.projectName}
        onClose={() => setPreviewPdfRecord(null)}
      />

      {/* Modal เพิ่ม Proposal แบบคีย์ Manual */}
      <AddProposalModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreate={handleCreateProposal}
      />
    </div>
  );
}
