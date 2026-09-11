"use client";

import { useState, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";

interface PDFViewerProps {
  file: File | null;
  sampleName?: string;
}

export function PDFViewer({ file, sampleName }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPdfUrl(null);
    }
  }, [file]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div
      className={`h-full flex flex-col bg-slate-900/5 border-r border-slate-200 select-none ${
        isFullScreen ? "fixed inset-0 z-50 bg-slate-900/90 p-4" : "relative"
      }`}
    >
      {/* Top Toolbar */}
      <div className="h-12 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center space-x-2 text-xs text-slate-600 truncate max-w-[200px] md:max-w-xs">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-medium truncate">
            {file ? file.name : sampleName || "รอการอัปโหลดเอกสาร (Live Preview)"}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleZoomOut}
            title="ซูมออก"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono font-medium text-slate-500 w-10 text-center">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            title="ซูมเข้า"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          <button
            onClick={handleRotate}
            title="หมุนเอกสาร 90°"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoom}
            title="รีเซ็ตมุมมอง"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            title="เต็มจอ"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors ml-1"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF / Document Viewport */}
      <div className="flex-1 overflow-auto p-4 md:p-6 flex items-start justify-center bg-slate-100/80">
        {pdfUrl ? (
          <div
            className="transition-transform duration-200 origin-top shadow-xl rounded-md bg-white overflow-hidden border border-slate-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              width: "100%",
              maxWidth: "750px",
              height: "900px",
            }}
          >
            <object
              data={`${pdfUrl}#toolbar=0&navpanes=0`}
              type="application/pdf"
              className="w-full h-full"
            >
              <iframe
                src={`${pdfUrl}#toolbar=0`}
                className="w-full h-full border-0"
                title="PDF Document"
              />
            </object>
          </div>
        ) : (
          /* Empty state — waiting for a PDF to be uploaded */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center">
              <UploadCloud className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-500">ยังไม่มีเอกสาร PDF</p>
            <p className="text-xs text-slate-400 max-w-xs text-center leading-relaxed">
              กดปุ่ม &quot;Upload PDF&quot; ที่มุมขวาบนเพื่ออัปโหลดเอกสารข้อเสนอ แล้วระบบจะแสดงตัวอย่างเอกสารที่นี่
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
