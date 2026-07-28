import type { ErpConnectionStatus } from "./financial-integration-types";
import type { FinancialSyncHistoryItem } from "./financial-sync-types";

export interface AdminFinancialIntegrationListItem {
  organizationId: string;
  organizationName?: string;
  provider: string;
  status: ErpConnectionStatus | string;
  lastSyncedAt: string | null;
}

export interface AdminFinancialFailedTransaction {
  id: string;
  organizationId: string;
  organizationName?: string;
  amountMinor?: number;
  currency?: string;
  failureReason?: string | null;
  createdAt: string;
}

export interface AdminFinancialEvent {
  id: string;
  type: string;
  organizationId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type AdminFinancialSyncItem = FinancialSyncHistoryItem & {
  organizationId?: string;
  organizationName?: string;
};
