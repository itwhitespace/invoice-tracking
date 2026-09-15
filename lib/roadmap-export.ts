import type ExcelJSType from "exceljs";
import { SavedRecord, PaymentStatus } from "./types";
import { getDepartmentAbbreviation, formatDepartmentLabel } from "./department-utils";
import { buildRoadmapTimeline, RoadmapMonthConfig, RoadmapTimelineRow } from "./roadmap-timeline";

// Solid ARGB fills matching the Tailwind colors used on the web Gantt chart.
const STAGE_ALL_FILL = "FFE2E8F0"; // slate-200
const HEADER_FILL = "FFFEF3C7"; // amber-100
const WEEK_ROW_FILL = "FFFFFBEB"; // amber-50
const TOTALS_FILL = "FFA7F3D0"; // emerald-200
const TOTALS_FONT = "FF065F46"; // emerald-800

const STATUS_FILLS: Record<PaymentStatus, { bg: string; font: string }> = {
  wait: { bg: "FFFCD34D", font: "FF78350F" },
  invoice: { bg: "FF7DD3FC", font: "FF0C4A6E" },
  paid: { bg: "FF6EE7B7", font: "FF064E3B" },
  hold: { bg: "FFC4B5FD", font: "FF4C1D95" },
  cancelled: { bg: "FFFCA5A5", font: "FF7F1D1D" },
};

function solidFill(argb: string): ExcelJSType.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ], and must be unique in
// the workbook — dedupe by appending a counter on collision.
function sanitizeSheetName(name: string, used: Set<string>): string {
  let cleaned = name.replace(/[:\\/?*[\]]/g, "-").trim().slice(0, 31) || "Sheet";
  let candidate = cleaned;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n})`;
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used.add(candidate);
  return candidate;
}

function addRoadmapSheet(
  workbook: ExcelJSType.Workbook,
  sheetName: string,
  monthHeaders: RoadmapMonthConfig[],
  timelineRows: RoadmapTimelineRow[],
  monthlyTotals: number[],
  totalGridColumns: number,
  rangeLabel?: string
) {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 3 }],
  });

  const totalCols = 1 + totalGridColumns; // name column + one column per week

  sheet.getColumn(1).width = 40;
  for (let c = 2; c <= totalCols; c++) sheet.getColumn(c).width = 9;

  // --- Row 1: month names / Row 2: monthly totals / Row 3: week labels ---
  const monthRow = sheet.getRow(1);
  monthRow.getCell(1).value = `Project Name${rangeLabel ? ` (${rangeLabel})` : ""}`;
  monthRow.getCell(1).font = { bold: true, size: 10 };
  monthRow.getCell(1).fill = solidFill(HEADER_FILL);

  const totalsRow = sheet.getRow(2);
  totalsRow.getCell(1).value = "ยอดรวมต่อเดือน";
  totalsRow.getCell(1).font = { bold: true, size: 9, color: { argb: TOTALS_FONT } };
  totalsRow.getCell(1).fill = solidFill(TOTALS_FILL);

  const weekRow = sheet.getRow(3);
  weekRow.getCell(1).value = "ข้อมูลโครงการจาก Proposal";
  weekRow.getCell(1).font = { size: 8, color: { argb: "FF64748B" } };
  weekRow.getCell(1).fill = solidFill(WEEK_ROW_FILL);

  let colCursor = 2;
  monthHeaders.forEach((m, mIdx) => {
    const startC = colCursor;
    const endC = colCursor + m.weeksCount - 1;

    if (endC > startC) sheet.mergeCells(1, startC, 1, endC);
    const monthCell = monthRow.getCell(startC);
    monthCell.value = m.name;
    monthCell.font = { bold: true, size: 10 };
    monthCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = startC; c <= endC; c++) monthRow.getCell(c).fill = solidFill(HEADER_FILL);

    if (endC > startC) sheet.mergeCells(2, startC, 2, endC);
    const totalCell = totalsRow.getCell(startC);
    const amt = monthlyTotals[mIdx] || 0;
    if (amt > 0) {
      totalCell.value = amt;
      totalCell.numFmt = '"฿"#,##0';
    } else {
      totalCell.value = "-";
    }
    totalCell.font = { bold: true, size: 9, color: { argb: TOTALS_FONT } };
    totalCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = startC; c <= endC; c++) totalsRow.getCell(c).fill = solidFill(TOTALS_FILL);

    for (let w = 0; w < m.weeksCount; w++) {
      const wc = weekRow.getCell(startC + w);
      wc.value = `W${w + 1}`;
      wc.font = { size: 8, color: { argb: "FF334155" } };
      wc.alignment = { horizontal: "center" };
      wc.fill = solidFill(WEEK_ROW_FILL);
    }

    colCursor = endC + 1;
  });

  // --- One row per project ---
  let r = 4;
  for (const row of timelineRows) {
    const proj = row.project;
    const nameLines = [
      `${getDepartmentAbbreviation(proj.department)}  ${proj.projectName}`,
      `฿${(proj.totalFee || 0).toLocaleString("en-US")} • ${proj.area || ""}`,
    ];
    if (proj.roadmapNote) nameLines.push(`📝 ${proj.roadmapNote}`);

    const rr = sheet.getRow(r);
    const nameCell = rr.getCell(1);
    nameCell.value = nameLines.join("\n");
    nameCell.alignment = { wrapText: true, vertical: "top" };
    nameCell.font = { size: 9, bold: true };

    if (!row.hasStage) {
      if (totalCols > 2) sheet.mergeCells(r, 2, r, totalCols);
      const warnCell = rr.getCell(2);
      warnCell.value = row.noStartDate
        ? "ยังไม่ได้ระบุ Start Date"
        : `เกิดข้อผิดพลาดในการคำนวณตำแหน่งของ Start Date (${proj.startDate})`;
      warnCell.font = { size: 9, italic: true, color: { argb: "FFB45309" } };
      warnCell.fill = solidFill(WEEK_ROW_FILL);
      warnCell.alignment = { vertical: "middle" };
      rr.height = 40;
      r += 1;
      continue;
    }

    const startC = row.startCol + 2; // +1 to skip the name column, +1 for 1-based indexing
    const endC = startC + row.totalSpanCols - 1;
    for (let c = startC; c <= endC; c++) {
      rr.getCell(c).fill = solidFill(STAGE_ALL_FILL);
    }

    for (const pm of row.paymentMarkers) {
      const c = pm.col + 2;
      const cell = rr.getCell(c);
      const style = STATUS_FILLS[pm.status];
      cell.fill = solidFill(style.bg);
      cell.value = `${pm.ptIdx + 1}/${proj.paymentTerms.length}\n${pm.amount.toLocaleString("en-US")}`;
      cell.font = { size: 8, bold: true, color: { argb: style.font } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    rr.height = 30;

    r += 1;
  }
}

// Groups the given (already on-screen-filtered) projects by Department and
// builds one worksheet per department — each auto-fit to only that
// department's own date range, mirroring what "แยกช่วงตามแผนก" means on the
// Roadmap page itself. Projects with no department land in a shared
// "ไม่ระบุแผนก" sheet.
export async function exportRoadmapToExcel(params: { projects: SavedRecord[] }) {
  const { projects } = params;

  const groups = new Map<string, SavedRecord[]>();
  for (const proj of projects) {
    const key = proj.department || "";
    const list = groups.get(key);
    if (list) list.push(proj);
    else groups.set(key, [proj]);
  }

  // Departments in their usual display order, unspecified last.
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Invoice Tracking Program";
  workbook.created = new Date();

  const usedSheetNames = new Set<string>();

  for (const key of orderedKeys) {
    const groupProjects = groups.get(key)!;
    const { monthHeaders, timelineRows, monthlyTotals, totalGridColumns } =
      buildRoadmapTimeline(groupProjects);

    const rangeLabel =
      monthHeaders.length > 0
        ? `${monthHeaders[0].name} – ${monthHeaders[monthHeaders.length - 1].name}`
        : undefined;

    const sheetName = sanitizeSheetName(key ? formatDepartmentLabel(key) : "ไม่ระบุแผนก", usedSheetNames);

    addRoadmapSheet(workbook, sheetName, monthHeaders, timelineRows, monthlyTotals, totalGridColumns, rangeLabel);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Project-Roadmap-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
