import { Department } from "./types";

export const DEPARTMENT_OPTIONS: Department[] = [
  "studio-1",
  "studio-2",
  "studio-3",
  "studio-4",
  "Signage",
  "Branding",
  "Digital Mkt",
  "Merge",
];

// Capitalizes only the first character — "studio-1" -> "Studio-1". Values
// that are already capitalized (Signage, Branding) pass through unchanged.
export const formatDepartmentLabel = (dept: string): string =>
  dept ? dept.charAt(0).toUpperCase() + dept.slice(1) : dept;

// Short badge abbreviation shown on the Roadmap: studio-N -> STN; anything
// else falls back to its first 3 letters (Signage -> SIG, Branding -> BRA).
export const getDepartmentAbbreviation = (dept?: string): string => {
  if (!dept) return "-";
  const studioMatch = dept.match(/^studio-(\d)$/i);
  if (studioMatch) return `ST${studioMatch[1]}`;
  return dept.slice(0, 3).toUpperCase();
};

// One distinct color per department for the Roadmap's abbreviation badge,
// so departments are told apart at a glance instead of all sharing the same
// gray. Falls back to gray for an unassigned/unrecognized department.
const DEPARTMENT_BADGE_COLORS: Record<string, string> = {
  "studio-1": "bg-sky-100 border-sky-300 text-sky-700",
  "studio-2": "bg-violet-100 border-violet-300 text-violet-700",
  "studio-3": "bg-amber-100 border-amber-300 text-amber-700",
  "studio-4": "bg-rose-100 border-rose-300 text-rose-700",
  Signage: "bg-emerald-100 border-emerald-300 text-emerald-700",
  Branding: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700",
  "Digital Mkt": "bg-cyan-100 border-cyan-300 text-cyan-700",
  Merge: "bg-orange-100 border-orange-300 text-orange-700",
};

export const getDepartmentBadgeClasses = (dept?: string): string =>
  (dept && DEPARTMENT_BADGE_COLORS[dept]) || "bg-slate-100 border-slate-300 text-slate-700";
