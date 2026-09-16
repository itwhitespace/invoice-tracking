// Shared helpers for comma-formatted numeric text inputs (Total Fee,
// Payment Term amounts, Targets, etc.) — display with thousands separators
// while keeping the underlying value a plain number.

export function formatThousands(value: number): string {
  return value ? value.toLocaleString("en-US") : "";
}

export function parseThousands(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
