/**
 * Display-only helper. Amounts are always entered/stored as integer minor
 * units (cents) - this never feeds back into a request body, it only makes
 * list/detail pages easier to scan.
 */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}
