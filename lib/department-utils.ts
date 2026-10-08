import { Department } from "./types";

export const DEPARTMENT_OPTIONS: Department[] = [
  "studio-1",
  "studio-2",
  "studio-3",
  "studio-4",
  "Panda",
  "Panther",
  "Penguin",
  "Merge",
];

// Departments renamed in Oct 2026. Data saved under the old names (Supabase
// rows not yet migrated, or a browser's local storage) is mapped on load.
const LEGACY_DEPARTMENT_NAMES: Record<string, Department> = {
  Signage: "Panda",
  Branding: "Panther",
  "Digital Mkt": "Penguin",
};

export const normalizeDepartment = (dept?: string | null): string =>
  dept ? LEGACY_DEPARTMENT_NAMES[dept] || dept : "";

// Capitalizes only the first character — "studio-1" -> "Studio-1". Values
// that are already capitalized (Panda, Merge) pass through unchanged.
export const formatDepartmentLabel = (dept: string): string =>
  dept ? dept.charAt(0).toUpperCase() + dept.slice(1) : dept;

// Panda and Panther would both shorten to "PAN", so these are set by hand.
const DEPARTMENT_ABBREVIATIONS: Record<string, string> = {
  Panda: "PDA",
  Panther: "PTH",
  Penguin: "PEN",
};

// Short badge abbreviation shown on the Roadmap: studio-N -> STN; anything
// else without an explicit abbreviation falls back to its first 3 letters.
export const getDepartmentAbbreviation = (dept?: string): string => {
  if (!dept) return "-";
  const studioMatch = dept.match(/^studio-(\d)$/i);
  if (studioMatch) return `ST${studioMatch[1]}`;
  return DEPARTMENT_ABBREVIATIONS[dept] || dept.slice(0, 3).toUpperCase();
};

// One distinct color per department for the Roadmap's abbreviation badge,
// so departments are told apart at a glance instead of all sharing the same
// gray. Falls back to gray for an unassigned/unrecognized department.
const DEPARTMENT_BADGE_COLORS: Record<string, string> = {
  "studio-1": "bg-sky-100 border-sky-300 text-sky-700",
  "studio-2": "bg-violet-100 border-violet-300 text-violet-700",
  "studio-3": "bg-amber-100 border-amber-300 text-amber-700",
  "studio-4": "bg-rose-100 border-rose-300 text-rose-700",
  Panda: "bg-emerald-100 border-emerald-300 text-emerald-700",
  Panther: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700",
  Penguin: "bg-cyan-100 border-cyan-300 text-cyan-700",
  Merge: "bg-orange-100 border-orange-300 text-orange-700",
};

export const getDepartmentBadgeClasses = (dept?: string): string =>
  (dept && DEPARTMENT_BADGE_COLORS[dept]) || "bg-slate-100 border-slate-300 text-slate-700";
