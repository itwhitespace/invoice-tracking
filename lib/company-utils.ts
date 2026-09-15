// The stored companyName value for the second company is "Whitespaceconnect"
// (matches what's already saved in Supabase / local records) — "WSCN" here
// is only a shorter label for menus/badges, not the value filtered on.
export interface CompanyOption {
  label: string;
  value: string;
}

export const COMPANY_OPTIONS: CompanyOption[] = [
  { label: "Whitespace Partners", value: "Whitespace Partners" },
  { label: "WSCN", value: "Whitespaceconnect" },
];

export const getCompanyLabel = (value?: string): string => {
  if (!value) return "";
  const found = COMPANY_OPTIONS.find((c) => c.value === value);
  return found ? found.label : value;
};

// Which Department values belong to each company — used by the Dashboard's
// Summary tables to always show every one of a company's departments as a
// row, even ones with no approved projects yet.
export const COMPANY_DEPARTMENTS: Record<string, string[]> = {
  "Whitespace Partners": ["studio-1", "studio-2", "studio-3", "studio-4"],
  Whitespaceconnect: ["Signage", "Branding", "Digital Mkt", "Merge"],
};
