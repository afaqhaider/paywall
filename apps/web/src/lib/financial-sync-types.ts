export type FinancialSyncStatus = "PENDING" | "RETRYING" | "SYNCED" | "FAILED" | "DEAD_LETTER";

export interface FinancialSyncStatusSummary {
  provider: string;
  pendingCount: number;
  retryingCount: number;
  deadLetterCount: number;
  lastSyncedAt: string | null;
}

export interface FinancialSyncHistoryItem {
  id: string;
  financialEventId: string;
  provider: string;
  status: FinancialSyncStatus;
  attemptCount: number;
  erpReferenceNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface FinancialSyncAttempt {
  attemptNumber: number;
  status: FinancialSyncStatus;
  error: string | null;
  executedAt: string;
}

export interface FinancialSyncErrorInfo {
  error: string;
  occurredAt: string;
  resolved: boolean;
}

export interface FinancialSyncDetail extends FinancialSyncHistoryItem {
  history: FinancialSyncAttempt[];
  error: FinancialSyncErrorInfo | null;
  financialEvent: {
    type: string;
    payload: Record<string, unknown>;
  };
}

/** Badge variant helper - keeps status -> color mapping in one place. Only
 * "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function syncStatusVariant(
  status: FinancialSyncStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SYNCED":
      return "success";
    case "FAILED":
    case "DEAD_LETTER":
      return "destructive";
    case "PENDING":
    case "RETRYING":
      return "outline";
    default:
      return "default";
  }
}
