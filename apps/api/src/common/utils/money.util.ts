/**
 * Display-only helper for rendering integer minor-unit amounts (cents) as
 * a formatted currency string - never used to compute or store amounts,
 * which always stay integer minor units end-to-end.
 */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}
