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
