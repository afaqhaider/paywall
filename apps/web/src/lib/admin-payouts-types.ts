export interface AccruedSummary {
  organizationId: string;
  currency: string;
  totalVendorPayoutAmountMinor: number;
  entryCount: number;
}

export type PayoutStatus = "PENDING" | "PAID" | "CANCELLED";

export interface PayoutRecord {
  id: string;
  organizationId: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: PayoutStatus;
  paidAt: string | null;
  createdAt: string;
}

export function formatMinor(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}
