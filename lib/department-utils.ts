import { Department } from "./types";

export const DEPARTMENT_OPTIONS: Department[] = [
  "studio-1",
  "studio-2",
  "studio-3",
  "studio-4",
  "Signage",
  "Branding",
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
