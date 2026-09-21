import type ExcelJSType from "exceljs";
import { SavedRecord, PaymentStatus } from "./types";
import { DEPARTMENT_OPTIONS, getDepartmentAbbreviation, formatDepartmentLabel } from "./department-utils";
import { COMPANY_DEPARTMENTS } from "./company-utils";
import { departmentTargetKey } from "./supabase";
import { formatProjectDuration } from "./timeframe-utils";
import {
  buildTimelineForMonthHeaders,
  buildFiscalYearMonthHeadersForStartYear,
  RoadmapMonthConfig,
  RoadmapTimelineRow,
} from "./roadmap-timeline";

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

// Companies map to a fixed tab color (department sheets) / header color
// (Summary sheet blocks) — WSPN green tabs / blue header, WSCN yellow both.
const WSPN = "Whitespace Partners";
const WSCN = "Whitespaceconnect";
const TAB_COLOR_WSPN = "FF00B050"; // green
const TAB_COLOR_WSCN = "FFFFFF00"; // yellow
const SUMMARY_HEADER_WSPN_FILL = "FF1F4E78"; // dark blue
const SUMMARY_HEADER_WSCN_FILL = "FFFFFF00"; // yellow
const SUMMARY_DEPT_FONT_WSPN = "FF1F2937"; // slate-800
const SUMMARY_DEPT_FONT_WSCN = "FF6D28D9"; // violet-700

// Alternating background per 3-month block on the Summary sheet's month
// header row, cycling through this palette — purely a visual grouping aid.
const MONTH_BAND_PALETTE = ["FFD9D9D9", "FFFFF2CC", "FFDDEBF7", "FFFCE4D6", "FFE2EFDA"];

function solidFill(argb: string): ExcelJSType.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// Matches the web Gantt chart's marker labels — always in thousands (K).
function formatCompactAmount(amount: number): string {
  return `${(amount / 1000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
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

// Which company most of a project subset belongs to — used to pick a
// department sheet's tab color. Departments are 1:1 with a company in
// practice, so this is just a safety net against a mixed/ambiguous group.
function majorityCompany(projects: SavedRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const p of projects) {
    const c = p.companyName || "";
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

function tabColorForCompany(company: string | null): string | undefined {
  if (company === WSPN) return TAB_COLOR_WSPN;
  if (company === WSCN) return TAB_COLOR_WSCN;
  return undefined;
}

function addRoadmapSheet(
  workbook: ExcelJSType.Workbook,
  sheetName: string,
  monthHeaders: RoadmapMonthConfig[],
  timelineRows: RoadmapTimelineRow[],
  monthlyTotals: number[],
  totalGridColumns: number,
  rangeLabel: string | undefined,
  tabColorArgb: string | undefined
): ExcelJSType.Worksheet {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2 }],
  });
  if (tabColorArgb) sheet.properties.tabColor = { argb: tabColorArgb };

  const totalCols = 1 + totalGridColumns; // name column + one column per week

  sheet.getColumn(1).width = 40;
  for (let c = 2; c <= totalCols; c++) sheet.getColumn(c).width = 9;

  // --- Row 1: month names / Row 2: week labels — the monthly totals row
  // moves to the very bottom of the sheet, after every project row, instead
  // of sitting up here. ---
  const monthRow = sheet.getRow(1);
  monthRow.getCell(1).value = `Project Name${rangeLabel ? ` (${rangeLabel})` : ""}`;
  monthRow.getCell(1).font = { bold: true, size: 10 };
  monthRow.getCell(1).fill = solidFill(HEADER_FILL);

  const weekRow = sheet.getRow(2);
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

    for (let w = 0; w < m.weeksCount; w++) {
      const wc = weekRow.getCell(startC + w);
      wc.value = `W${w + 1}`;
      wc.font = { size: 8, color: { argb: "FF334155" } };
      wc.alignment = { horizontal: "center" };
      wc.fill = solidFill(WEEK_ROW_FILL);
    }

    colCursor = endC + 1;
  });

  // --- One row per project — the Excel export always lists every project
  // regardless of roadmapHidden; only the on-screen Roadmap table hides them.
  let r = 3;
  for (const row of timelineRows) {
    const proj = row.project;
    const nameLines = [
      `${getDepartmentAbbreviation(proj.department)}  ${proj.projectName}`,
      `฿${(proj.totalFee || 0).toLocaleString("en-US")} • ${formatProjectDuration(proj)}`,
    ];
    if (proj.roadmapNote) nameLines.push(proj.roadmapNote);

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
      cell.value = `${pm.ptIdx + 1}/${proj.paymentTerms.length}\n${formatCompactAmount(pm.amount)}`;
      cell.font = { size: 8, bold: true, color: { argb: style.font } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    rr.height = 30;

    r += 1;
  }

  // --- Monthly totals row, at the very bottom ---
  const totalsRow = sheet.getRow(r);
  totalsRow.getCell(1).value = "ยอดรวมต่อเดือน";
  totalsRow.getCell(1).font = { bold: true, size: 9, color: { argb: TOTALS_FONT } };
  totalsRow.getCell(1).fill = solidFill(TOTALS_FILL);
  totalsRow.getCell(1).border = { top: { style: "thin" } };

  let totalsColCursor = 2;
  monthHeaders.forEach((m, mIdx) => {
    const startC = totalsColCursor;
    const endC = totalsColCursor + m.weeksCount - 1;

    if (endC > startC) sheet.mergeCells(r, startC, r, endC);
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
    for (let c = startC; c <= endC; c++) {
      totalsRow.getCell(c).fill = solidFill(TOTALS_FILL);
      totalsRow.getCell(c).border = { top: { style: "thin" } };
    }

    totalsColCursor = endC + 1;
  });

  return sheet;
}

// One block per company, placed under its monthly grid on the Summary
// sheet: Department / Target / Actual / % Complete, matching the Dashboard
// page's "Annual Billing" table (scoped to the given fiscal year).
function addAnnualBillingBlock(
  sheet: ExcelJSType.Worksheet,
  startRow: number,
  startCol: number,
  company: { name: string; label: string; headerFill: string; headerFont: string; deptFont: string },
  companyProjects: SavedRecord[],
  fiscalMonthHeaders: RoadmapMonthConfig[],
  targets: Record<string, number>,
  fiscalYearStart: number
): number {
  let r = startRow;
  const departments = COMPANY_DEPARTMENTS[company.name] || [];
  const col = (offset: number) => startCol + offset;

  const titleRow = sheet.getRow(r);
  sheet.mergeCells(r, col(0), r, col(3));
  const titleCell = titleRow.getCell(col(0));
  titleCell.value = `${company.label} — Annual Billing`;
  titleCell.font = { bold: true, size: 11, color: { argb: company.headerFont } };
  titleCell.fill = solidFill(company.headerFill);
  titleCell.alignment = { vertical: "middle" };
  titleRow.height = 20;
  r += 1;

  const colHeaderRow = sheet.getRow(r);
  ["Department", "Target", "Actual", "% Complete"].forEach((label, idx) => {
    const cell = colHeaderRow.getCell(col(idx));
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: idx === 0 ? "left" : "center" };
  });
  r += 1;

  let totalTarget = 0;
  let totalActual = 0;
  for (const dept of departments) {
    const deptProjects = companyProjects.filter((p) => p.department === dept);
    const { monthlyTotals } = buildTimelineForMonthHeaders(deptProjects, fiscalMonthHeaders);
    const actual = monthlyTotals.reduce((sum, v) => sum + v, 0);
    const target = targets[departmentTargetKey(company.name, dept, fiscalYearStart)] || 0;
    totalTarget += target;
    totalActual += actual;

    const row = sheet.getRow(r);
    const nameCell = row.getCell(col(0));
    nameCell.value = formatDepartmentLabel(dept);
    nameCell.font = { size: 10, color: { argb: company.deptFont } };

    const targetCell = row.getCell(col(1));
    if (target > 0) {
      targetCell.value = target;
      targetCell.numFmt = '"฿"#,##0';
    }
    targetCell.font = { size: 10 };
    targetCell.alignment = { horizontal: "center" };

    const actualCell = row.getCell(col(2));
    if (actual > 0) {
      actualCell.value = actual;
      actualCell.numFmt = '"฿"#,##0';
    }
    actualCell.font = { size: 10 };
    actualCell.alignment = { horizontal: "center" };

    const pctCell = row.getCell(col(3));
    if (target > 0) {
      pctCell.value = actual / target;
      pctCell.numFmt = "0%";
    } else {
      pctCell.value = "-";
    }
    pctCell.font = { size: 10 };
    pctCell.alignment = { horizontal: "center" };

    r += 1;
  }

  const totalRow = sheet.getRow(r);
  const totalLabelCell = totalRow.getCell(col(0));
  totalLabelCell.value = "Total";
  totalLabelCell.font = { bold: true, size: 10 };
  totalLabelCell.border = { top: { style: "thin" } };

  const totalTargetCell = totalRow.getCell(col(1));
  if (totalTarget > 0) {
    totalTargetCell.value = totalTarget;
    totalTargetCell.numFmt = '"฿"#,##0';
  }
  totalTargetCell.font = { bold: true, size: 10 };
  totalTargetCell.alignment = { horizontal: "center" };
  totalTargetCell.border = { top: { style: "thin" } };

  const totalActualCell = totalRow.getCell(col(2));
  if (totalActual > 0) {
    totalActualCell.value = totalActual;
    totalActualCell.numFmt = '"฿"#,##0';
  }
  totalActualCell.font = { bold: true, size: 10 };
  totalActualCell.alignment = { horizontal: "center" };
  totalActualCell.border = { top: { style: "thin" } };

  const totalPctCell = totalRow.getCell(col(3));
  if (totalTarget > 0) {
    totalPctCell.value = totalActual / totalTarget;
    totalPctCell.numFmt = "0%";
  } else {
    totalPctCell.value = "-";
  }
  totalPctCell.font = { bold: true, size: 10 };
  totalPctCell.alignment = { horizontal: "center" };
  totalPctCell.border = { top: { style: "thin" } };

  r += 2; // blank row gap after this block
  return r;
}

// One combined Summary sheet, placed first: both companies' monthly-totals
// tables (Whitespace Partners, then Whitespaceconnect — each broken down by
// Department, with a Total row) stacked first, followed by both companies'
// Annual Billing (Target / Actual / % Complete) blocks after. monthHeaders
// here is the fixed Oct-Sep fiscal-year range the whole report is scoped to.
function addSummarySheet(
  workbook: ExcelJSType.Workbook,
  projects: SavedRecord[],
  monthHeaders: RoadmapMonthConfig[],
  targets: Record<string, number>,
  fiscalYearStart: number
) {
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 0 }],
  });

  const totalCols = 1 + monthHeaders.length;
  sheet.getColumn(1).width = 26;
  for (let c = 2; c <= totalCols; c++) sheet.getColumn(c).width = 13;

  const departmentSortIndex = (dept: string) => {
    const idx = DEPARTMENT_OPTIONS.indexOf(dept as any);
    return idx === -1 ? DEPARTMENT_OPTIONS.length : idx;
  };

  let r = 1;

  const companies: { name: string; label: string; headerFill: string; headerFont: string; deptFont: string }[] = [
    { name: WSPN, label: "WSPN", headerFill: SUMMARY_HEADER_WSPN_FILL, headerFont: "FFFFFFFF", deptFont: SUMMARY_DEPT_FONT_WSPN },
    { name: WSCN, label: "WSCN", headerFill: SUMMARY_HEADER_WSCN_FILL, headerFont: "FF1F2937", deptFont: SUMMARY_DEPT_FONT_WSCN },
  ];

  const companiesWithProjects: { company: (typeof companies)[number]; companyProjects: SavedRecord[] }[] = [];

  // --- Pass 1: every company's monthly grid, one after another ---
  for (const company of companies) {
    const companyProjects = projects.filter((p) => p.companyName === company.name);
    if (companyProjects.length === 0) continue;
    companiesWithProjects.push({ company, companyProjects });

    // --- Header row: company label + month names, banded every 3 months ---
    const headerRow = sheet.getRow(r);
    const labelCell = headerRow.getCell(1);
    labelCell.value = company.label;
    labelCell.font = { bold: true, size: 11, color: { argb: company.headerFont } };
    labelCell.fill = solidFill(company.headerFill);
    labelCell.alignment = { vertical: "middle" };

    monthHeaders.forEach((m, mIdx) => {
      const cell = headerRow.getCell(mIdx + 2);
      cell.value = m.name;
      cell.font = { bold: true, size: 10 };
      cell.fill = solidFill(MONTH_BAND_PALETTE[Math.floor(mIdx / 3) % MONTH_BAND_PALETTE.length]);
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 20;
    r += 1;

    // --- One row per department present for this company ---
    const deptGroups = new Map<string, SavedRecord[]>();
    for (const proj of companyProjects) {
      const key = proj.department || "";
      const list = deptGroups.get(key);
      if (list) list.push(proj);
      else deptGroups.set(key, [proj]);
    }
    const deptKeys = [...deptGroups.keys()].sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return departmentSortIndex(a) - departmentSortIndex(b);
    });

    for (const key of deptKeys) {
      const deptProjects = deptGroups.get(key)!;
      const { monthlyTotals } = buildTimelineForMonthHeaders(deptProjects, monthHeaders);

      const deptRow = sheet.getRow(r);
      const nameCell = deptRow.getCell(1);
      nameCell.value = key ? formatDepartmentLabel(key) : "ไม่ระบุแผนก";
      nameCell.font = { size: 10, color: { argb: company.deptFont } };

      monthlyTotals.forEach((amt, mIdx) => {
        const cell = deptRow.getCell(mIdx + 2);
        if (amt > 0) {
          cell.value = amt;
          cell.numFmt = '"฿"#,##0';
        }
        cell.alignment = { horizontal: "center" };
        cell.font = { size: 10 };
      });
      r += 1;
    }

    // --- Total row for this company ---
    const { monthlyTotals: companyTotals } = buildTimelineForMonthHeaders(companyProjects, monthHeaders);
    const totalRow = sheet.getRow(r);
    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.value = "Total";
    totalLabelCell.font = { bold: true, size: 10 };
    totalLabelCell.alignment = { horizontal: "right" };
    totalLabelCell.border = { top: { style: "thin" } };

    companyTotals.forEach((amt, mIdx) => {
      const cell = totalRow.getCell(mIdx + 2);
      if (amt > 0) {
        cell.value = amt;
        cell.numFmt = '"฿"#,##0';
      }
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: "center" };
      cell.border = { top: { style: "thin" } };
    });
    r += 2; // blank row gap before the next company's monthly grid
  }

  // --- Pass 2: every company's Annual Billing block, after all the grids ---
  for (const { company, companyProjects } of companiesWithProjects) {
    r = addAnnualBillingBlock(sheet, r, 1, company, companyProjects, monthHeaders, targets, fiscalYearStart);
  }
}

// Groups projects by Department, ordered to match DEPARTMENT_OPTIONS with
// unassigned ones last — shared by both export flavors below.
function groupProjectsByDepartment(projects: SavedRecord[]): [string, SavedRecord[]][] {
  const groups = new Map<string, SavedRecord[]>();
  for (const proj of projects) {
    const key = proj.department || "";
    const list = groups.get(key);
    if (list) list.push(proj);
    else groups.set(key, [proj]);
  }

  const departmentSortIndex = (dept: string) => {
    const idx = DEPARTMENT_OPTIONS.indexOf(dept as any);
    return idx === -1 ? DEPARTMENT_OPTIONS.length : idx;
  };
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return departmentSortIndex(a) - departmentSortIndex(b);
  });

  return orderedKeys.map((key) => [key, groups.get(key)!]);
}

function triggerWorkbookDownload(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// The Dashboard page's export — a single fiscal-year budget report: every
// sheet (Gantt per department, Summary monthly totals, and Annual Billing)
// scoped to the same fixed Oct-Sep window the Dashboard is currently
// showing, so the whole workbook reads as one consistent period. A project
// active outside that window just won't show on it.
export async function exportFiscalYearBillingReportToExcel(params: {
  projects: SavedRecord[];
  targets: Record<string, number>;
  fiscalYearStart: number;
}) {
  const { projects, targets, fiscalYearStart } = params;

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Invoice Tracking Program";
  workbook.created = new Date();

  const fiscalMonthHeaders = buildFiscalYearMonthHeadersForStartYear(fiscalYearStart);
  const rangeLabel =
    fiscalMonthHeaders.length > 0
      ? `${fiscalMonthHeaders[0].name} – ${fiscalMonthHeaders[fiscalMonthHeaders.length - 1].name}`
      : undefined;

  addSummarySheet(workbook, projects, fiscalMonthHeaders, targets, fiscalYearStart);

  const usedSheetNames = new Set<string>(["Summary"]);
  for (const [key, groupProjects] of groupProjectsByDepartment(projects)) {
    const { timelineRows, monthlyTotals, totalGridColumns } = buildTimelineForMonthHeaders(
      groupProjects,
      fiscalMonthHeaders
    );

    const sheetName = sanitizeSheetName(key ? formatDepartmentLabel(key) : "ไม่ระบุแผนก", usedSheetNames);
    const tabColor = tabColorForCompany(majorityCompany(groupProjects));

    addRoadmapSheet(
      workbook,
      sheetName,
      fiscalMonthHeaders,
      timelineRows,
      monthlyTotals,
      totalGridColumns,
      rangeLabel,
      tabColor
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileRangeLabel = rangeLabel ? rangeLabel.replace(/\s+/g, "") : String(fiscalYearStart);
  triggerWorkbookDownload(buffer as ArrayBuffer, `Budget-Report-${fileRangeLabel}.xlsx`);
}
