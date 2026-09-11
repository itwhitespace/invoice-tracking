"use client";

import { useState, useEffect } from "react";
import { PDFViewer } from "@/components/pdf-viewer";
import { ExtractionForm } from "@/components/extraction-form";
import { HeaderBar } from "@/components/header-bar";
import { HistoryDrawer } from "@/components/history-drawer";
import { ExtractionProgressModal } from "@/components/extraction-progress-modal";
import { SaveSuccessModal } from "@/components/save-success-modal";
import { useSettings } from "@/lib/settings-context";
import {
  ExtractedProjectData,
  SavedRecord,
} from "@/lib/types";
import { EMPTY_PROJECT_DATA } from "@/lib/sample-data";
import {
  getSupabaseClient,
  getSavedRecords,
  saveRecordLocally,
  deleteRecordLocally,
  deleteRecordRemote,
  isRemoteId,
} from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function UploadProposalPage() {
  const { settings } = useSettings();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [sampleName, setSampleName] = useState<string>("");
  const [data, setData] = useState<ExtractedProjectData>(EMPTY_PROJECT_DATA);
  const [isAiExtracted, setIsAiExtracted] = useState<boolean>(false);
  // True only when a real uploaded PDF got back the Demo/Mock dataset instead
  // of a genuine Gemini extraction (e.g. no API key configured yet) — this is
  // the case that silently confused users since the result looks unrelated
  // to their document.
  const [isDemoFallback, setIsDemoFallback] = useState<boolean>(false);

  // Loading States
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isExtractCompleted, setIsExtractCompleted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Drawers
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);

  // Save Success Modal
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{
    type: "success" | "warning" | "info";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "warning" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load saved records on mount (Supabase is the shared source of truth,
  // merged with anything still only saved locally on this device)
  useEffect(() => {
    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    getSavedRecords(supabase).then(setSavedRecords);
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Upload handler
  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    setSampleName(uploadedFile.name);
    // Auto-trigger extraction
    extractPDFData(uploadedFile);
  };

  // AI Extraction Function
  const extractPDFData = async (pdfFile: File) => {
    setIsExtracting(true);
    setIsExtractCompleted(false);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      if (settings.geminiApiKey) {
        formData.append("apiKey", settings.geminiApiKey);
      }
      if (settings.preferredModel) {
        formData.append("model", settings.preferredModel);
      }
      if (settings.useMockExtraction) {
        formData.append("isMock", "true");
      }

      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to extract PDF");
      }

      setData(json.data);
      setIsAiExtracted(true);
      setIsDemoFallback(!!json.isMock);
      setIsExtractCompleted(true);
      showToast(
        "success",
        json.isMock
          ? "สกัดข้อมูลตัวอย่างสำเร็จ (Demo Mode)"
          : "Gemini AI สกัดข้อมูลเอกสารและตารางสำเร็จเรียบร้อย!"
      );

      // Brief delay to showcase 100% completion checkmark
      await new Promise((resolve) => setTimeout(resolve, 750));
    } catch (error: any) {
      console.error("Extraction error:", error);
      showToast("warning", error.message || "เกิดข้อผิดพลาดในการประมวลผล PDF");
    } finally {
      setIsExtracting(false);
      setIsExtractCompleted(false);
    }
  };

  // Manual trigger for current file
  const handleExtractAI = () => {
    if (file) {
      extractPDFData(file);
    } else {
      showToast("warning", "กรุณาอัปโหลดไฟล์ PDF ก่อนเริ่มสกัดข้อมูล");
    }
  };

  // Save to Database / Supabase
  const handleSaveToDatabase = async () => {
    if (!data.projectName) {
      showToast("warning", "กรุณากรอก Project Name ก่อนบันทึก");
      return;
    }

    if (data.paymentTerms.length > 0 && data.paymentTerms.some((pt) => !pt.paymentWeek)) {
      showToast("warning", "กรุณาระบุ \"เก็บเงินสัปดาห์ที่\" ให้ครบทุกงวดในตาราง Payment Term ก่อนบันทึก");
      return;
    }

    setIsSaving(true);
    let supabaseStorageFailed = false;
    let supabaseStorageErrorMessage = "";
    let supabaseProjectInsertFailed = false;
    let supabaseProjectErrorMessage = "";
    try {
      let uploadedPdfUrl = "";
      let remoteProjectId = "";

      // 1. Check if Supabase client is configured
      const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);

      if (supabase && file) {
        // Upload to Supabase Storage so the file can be opened from Preview later
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { error: storageError } = await supabase.storage
          .from(settings.supabaseBucket || "pdf-documents")
          .upload(fileName, file);

        if (!storageError) {
          const { data: publicData } = supabase.storage
            .from(settings.supabaseBucket || "pdf-documents")
            .getPublicUrl(fileName);
          uploadedPdfUrl = publicData?.publicUrl || "";
        } else {
          console.warn("Supabase storage upload warning:", storageError);
          supabaseStorageFailed = true;
          supabaseStorageErrorMessage = storageError.message || String(storageError);
        }

        // Insert into Supabase table 'projects'
        const vatAmount = data.totalFee * 0.07;
        const { data: projectRow, error: projectError } = await supabase
          .from("projects")
          .insert({
            company_name: data.companyName || "",
            project_name: data.projectName,
            area: data.area,
            scope_of_work: data.scopeOfWork,
            total_fee: data.totalFee,
            special_discount: data.specialDiscount || 0,
            vat_amount: vatAmount,
            grand_total: data.totalFee + vatAmount,
            total_design_duration: data.totalDesignDuration || "",
            pdf_url: uploadedPdfUrl,
            pdf_file_name: file ? file.name : sampleName,
            status: "verified",
          })
          .select()
          .single();

        if (projectError) {
          console.warn("Supabase project insert warning:", projectError);
          supabaseProjectInsertFailed = true;
          supabaseProjectErrorMessage = projectError.message || String(projectError);
        } else if (projectRow) {
          const projectId = projectRow.id;
          remoteProjectId = projectId;

          // Insert Design Fee Items
          if (data.designFeeItems && data.designFeeItems.length > 0) {
            await supabase.from("project_design_fee_items").insert(
              data.designFeeItems.map((fi, i) => ({
                project_id: projectId,
                item: fi.item,
                description: fi.description,
                amount: fi.amount,
                sort_order: i,
              }))
            );
          }

          // Insert Timeframes
          if (data.timeFrames.length > 0) {
            await supabase.from("project_timeframes").insert(
              data.timeFrames.map((tf, i) => ({
                project_id: projectId,
                phase: tf.phase,
                description: tf.description,
                duration: tf.duration,
                sort_order: i,
              }))
            );
          }

          // Insert Payment Terms
          if (data.paymentTerms.length > 0) {
            await supabase.from("project_payment_terms").insert(
              data.paymentTerms.map((pt, i) => ({
                project_id: projectId,
                milestone: pt.milestone,
                payment_percentage: pt.paymentPercentage,
                amount: pt.amount,
                payment_week: pt.paymentWeek ?? null,
                invoice_date: pt.invoiceDate || null,
                payment_status: pt.paymentStatus || null,
                sort_order: i,
              }))
            );
          }
        }
      }

      // 2. Always persist to Local Storage History as reliable backup.
      // Reuse the Supabase row's uuid as the record id when the insert
      // succeeded, so later edits/approve/delete target the same row.
      const newRecord: SavedRecord = {
        id: remoteProjectId || `rec_${Date.now()}`,
        created_at: new Date().toISOString(),
        companyName: data.companyName || "",
        projectName: data.projectName,
        area: data.area,
        scopeOfWork: data.scopeOfWork,
        totalFee: data.totalFee,
        designFeeItems: data.designFeeItems || [],
        specialDiscount: data.specialDiscount || 0,
        timeFrames: [...data.timeFrames],
        totalDesignDuration: data.totalDesignDuration || "",
        paymentTerms: [...data.paymentTerms],
        pdfFileName: file ? file.name : sampleName,
        pdfUrl: uploadedPdfUrl,
        status: "verified",
      };

      const updatedRecords = saveRecordLocally(newRecord);
      setSavedRecords(updatedRecords);

      const problems: string[] = [];
      if (supabaseProjectInsertFailed) {
        problems.push(`บันทึกลงตาราง projects ไม่สำเร็จ: ${supabaseProjectErrorMessage}`);
      }
      if (supabaseStorageFailed) {
        problems.push(`อัปโหลดไฟล์ PDF ไปยัง Supabase Storage ไม่สำเร็จ: ${supabaseStorageErrorMessage}`);
      }

      if (problems.length > 0) {
        setSaveSuccessMessage(
          `บันทึกลง Local History เรียบร้อย แต่ Supabase มีปัญหา:\n${problems.join("\n")}`
        );
      } else {
        setSaveSuccessMessage(
          supabase
            ? "บันทึกลง Supabase Database & Storage สำเร็จเรียบร้อย!"
            : "บันทึกลงฐานข้อมูลเรียบร้อย (Saved to Database History)"
        );
      }
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("warning", "เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectRecord = (record: SavedRecord) => {
    setData({
      companyName: record.companyName || "",
      projectName: record.projectName,
      area: record.area,
      scopeOfWork: record.scopeOfWork,
      totalFee: record.totalFee,
      designFeeItems: record.designFeeItems || [],
      specialDiscount: record.specialDiscount || 0,
      timeFrames: record.timeFrames || [],
      totalDesignDuration: record.totalDesignDuration || "",
      paymentTerms: record.paymentTerms || [],
    });
    setSampleName(record.pdfFileName || record.projectName);
    setIsAiExtracted(false);
    showToast("info", `โหลดข้อมูล: ${record.projectName}`);
  };

  const handleDeleteRecord = async (id: string) => {
    const updated = deleteRecordLocally(id);
    setSavedRecords(updated);
    showToast("info", "ลบรายการเรียบร้อย");

    const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
    if (supabase && isRemoteId(id)) {
      const { error } = await deleteRecordRemote(supabase, id);
      if (error) {
        showToast("warning", "ลบใน Supabase ไม่สำเร็จ: " + error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Application Header */}
      <HeaderBar
        onFileUpload={handleFileUpload}
        onExtractAI={handleExtractAI}
        onSaveToDatabase={handleSaveToDatabase}
        onOpenHistory={() => setIsHistoryOpen(true)}
        isExtracting={isExtracting}
        isSaving={isSaving}
        hasFile={!!file}
        savedCount={savedRecords.length}
      />

      {/* Persistent Demo/Mock Fallback Warning (not a transient toast on purpose) */}
      {isDemoFallback && file && (
        <div className="px-4 md:px-6 py-2 bg-amber-50 border-b border-amber-300 flex items-center gap-2 text-xs text-amber-900 font-medium shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            ข้อมูลด้านล่างเป็น <strong>ข้อมูลตัวอย่าง (Demo)</strong> ไม่ใช่ข้อมูลจากไฟล์ PDF ที่อัปโหลดจริง
            เนื่องจากยังไม่ได้ตั้งค่า Gemini API Key
          </span>
          <Link href="/settings" className="underline font-semibold shrink-0 hover:text-amber-950">
            ไปตั้งค่า API Key
          </Link>
        </div>
      )}

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left Column: PDF Document Viewer */}
        <section className="h-full overflow-hidden border-r border-slate-200">
          <PDFViewer file={file} sampleName={sampleName} />
        </section>

        {/* Right Column: Editable Verification Form & Tables */}
        <section className="h-full overflow-hidden">
          <ExtractionForm
            data={data}
            onChange={setData}
            isAiExtracted={isAiExtracted}
            isDemoFallback={isDemoFallback && !!file}
          />
        </section>
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium ${
              toast.type === "success"
                ? "bg-slate-900 text-white border-slate-800"
                : toast.type === "warning"
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-slate-800 text-white border-slate-700"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            {toast.type === "warning" && (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {toast.type === "info" && (
              <Info className="w-4 h-4 text-indigo-300 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Center Screen Extraction Progress Modal with Percentage & Step Status */}
      <ExtractionProgressModal
        isOpen={isExtracting}
        isCompleted={isExtractCompleted}
        fileName={file ? file.name : sampleName}
        onCancel={() => {
          setIsExtracting(false);
          setIsExtractCompleted(false);
        }}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        records={savedRecords}
        onSelectRecord={handleSelectRecord}
        onDeleteRecord={handleDeleteRecord}
      />

      {/* Center Screen Save Success Modal */}
      <SaveSuccessModal
        isOpen={!!saveSuccessMessage}
        message={saveSuccessMessage || ""}
        onConfirm={() => {
          setSaveSuccessMessage(null);
          router.push("/proposal-preview");
        }}
        onClose={() => setSaveSuccessMessage(null)}
      />
    </div>
  );
}
