"use client";

import { useState, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  Eye,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

interface PDFViewerProps {
  file: File | null;
  sampleName?: string;
  onSelectSample?: (sampleType: "villa" | "cafe") => void;
}

export function PDFViewer({ file, sampleName, onSelectSample }: PDFViewerProps) {
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
            {file ? file.name : sampleName || "เอกสารตัวอย่าง (Live Preview)"}
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
          /* Realistic PDF Sheet Mockup when no custom file uploaded */
          <div
            className="transition-transform duration-200 origin-top shadow-2xl rounded-lg bg-white p-8 md:p-10 border border-slate-300/80 text-slate-800 flex flex-col justify-between"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              width: "100%",
              maxWidth: "680px",
              minHeight: "880px",
            }}
          >
            <div>
              {/* Header Letterhead */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="h-6 w-6 rounded bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                      A+
                    </span>
                    <span className="font-bold text-slate-900 tracking-tight text-base">
                      STUDIO ARCHITECTS & CO.
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Design Proposal & Professional Fee Agreement
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  <p>DOC NO: SA-2026-PROP-089</p>
                  <p>DATE: September 09, 2026</p>
                  <p>REVISION: 01 (Final Draft)</p>
                </div>
              </div>

              {/* Section 1: Project Brief */}
              <div className="mb-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  1. Project Brief & Scope
                </div>
                <div className="bg-slate-50 rounded p-3 border border-slate-200/70 text-xs space-y-1.5">
                  <div className="flex">
                    <span className="font-semibold text-slate-700 w-28">Project Name:</span>
                    <span className="text-slate-900 font-medium">
                      Villa Horizon Luxury Residence & Clubhouse
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold text-slate-700 w-28">Area / Size:</span>
                    <span className="text-slate-900">480 sq.m. (2-Story Villa + 120 sq.m. Landscape)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-semibold text-slate-700 w-28 shrink-0">Scope of Work:</span>
                    <span className="text-slate-600 leading-relaxed">
                      Complete Architectural & Interior Design including Concept Development, Schematic Design, 3D Renderings, Detailed Working Drawings, and Construction Supervision.
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Design Fees */}
              <div className="mb-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  2. Professional Design Fees
                </div>
                <div className="bg-slate-900 text-white p-3.5 rounded flex justify-between items-center">
                  <span className="text-xs text-slate-300 font-medium">
                    Total Lump-sum Design Fee (Excl. VAT)
                  </span>
                  <span className="text-lg font-bold font-mono tracking-tight text-white">
                    THB 1,450,000.00
                  </span>
                </div>
              </div>

              {/* Section 3: Estimated Time Frame */}
              <div className="mb-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  3. Estimated Time Frame & Schedule
                </div>
                <table className="w-full text-[11px] border border-slate-200 rounded">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-1.5 text-left w-36">Phase</th>
                      <th className="p-1.5 text-left">Description</th>
                      <th className="p-1.5 text-right w-20">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-600">
                    <tr>
                      <td className="p-1.5 font-medium text-slate-800">Phase 1: Concept Design</td>
                      <td className="p-1.5">Site analysis, preliminary space planning</td>
                      <td className="p-1.5 text-right font-mono">3 Weeks</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-medium text-slate-800">Phase 2: Schematic & 3D</td>
                      <td className="p-1.5">Refined 3D visualization & material selection</td>
                      <td className="p-1.5 text-right font-mono">4 Weeks</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-medium text-slate-800">Phase 3: Design Dev</td>
                      <td className="p-1.5">MEP coordination & architectural layout</td>
                      <td className="p-1.5 text-right font-mono">4 Weeks</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 4: Payment Terms */}
              <div className="mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  4. Payment Term & Milestone Schedule
                </div>
                <table className="w-full text-[11px] border border-slate-200 rounded">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-1.5 text-left">Milestone</th>
                      <th className="p-1.5 text-right w-16">%</th>
                      <th className="p-1.5 text-right w-28">Amount (THB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-600 font-mono text-[10.5px]">
                    <tr>
                      <td className="p-1.5 font-sans">1st Installment: Sign Agreement</td>
                      <td className="p-1.5 text-right">20%</td>
                      <td className="p-1.5 text-right">290,000.00</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-sans">2nd Installment: Concept Approval</td>
                      <td className="p-1.5 text-right">25%</td>
                      <td className="p-1.5 text-right">362,500.00</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-sans">3rd Installment: 3D Design Approval</td>
                      <td className="p-1.5 text-right">25%</td>
                      <td className="p-1.5 text-right">362,500.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Sample Selector Bar */}
            {onSelectSample && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50 -mx-8 md:-mx-10 -mb-8 md:-mb-10 p-3 rounded-b-lg">
                <span className="flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  เลือกตัวอย่างเอกสารทดสอบ:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelectSample("villa")}
                    className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded font-medium hover:bg-slate-50 text-slate-700 transition"
                  >
                    Villa Proposal
                  </button>
                  <button
                    onClick={() => onSelectSample("cafe")}
                    className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded font-medium hover:bg-slate-50 text-slate-700 transition"
                  >
                    Cafe Renovation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
