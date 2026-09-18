"use client";

import { SavedRecord } from "@/lib/types";
import { formatProjectDuration } from "@/lib/timeframe-utils";
import {
  X,
  Clock,
  Trash2,
  ExternalLink,
  Download,
  FolderArchive,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: SavedRecord[];
  onSelectRecord: (record: SavedRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  records,
  onSelectRecord,
  onDeleteRecord,
}: HistoryDrawerProps) {
  if (!isOpen) return null;

  const handleExportJSON = (record: SavedRecord) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(record, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${record.projectName.replace(/\s+/g, "_")}_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderArchive className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-800">
                ประวัติเอกสารที่บันทึก ({records.length})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Records List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {records.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center text-xs space-y-2">
                <Clock className="w-8 h-8 text-slate-300" />
                <p>ยังไม่มีประวัติการบันทึกข้อมูล</p>
                <p className="text-[11px] text-slate-400">
                  เมื่อคุณตรวจสอบข้อมูลและกด &quot;Save to Database&quot; เอกสารจะมาปรากฏที่นี่
                </p>
              </div>
            ) : (
              records.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {rec.projectName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(rec.created_at).toLocaleString("th-TH")}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {rec.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400">Duration: </span>
                      <span>{formatProjectDuration(rec)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Fee: </span>
                      <span className="font-mono font-bold text-slate-800">
                        THB {Number(rec.totalFee).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-mono">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>{rec.timeFrames?.length || 0} Phases</span>
                    <span>•</span>
                    <span>{rec.paymentTerms?.length || 0} Milestones</span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          onSelectRecord(rec);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded font-medium text-[11px] flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        โหลดดูข้อมูล
                      </button>
                      <button
                        onClick={() => handleExportJSON(rec)}
                        title="ดาวน์โหลดเป็น JSON"
                        className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteRecord(rec.id)}
                      title="ลบรายการนี้"
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
