import type { Subscription } from "./subscriptions-types";
import type { License } from "./licenses-types";
import type { DeviceRegistration } from "./devices-types";
import type { PaymentInvoice, PaymentTransaction } from "./payments-types";

export type AdminCustomerStatus = "ACTIVE" | "SUSPENDED";

export interface AdminCustomerListItem {
  id: string;
  organizationId: string;
  organizationName?: string;
  userId?: string | null;
  displayName: string | null;
  email: string | null;
  status?: AdminCustomerStatus;
  createdAt?: string;
}

export interface AdminCustomerFinancialSyncStatus {
  status: string;
  lastSyncedAt: string | null;
  pendingCount?: number;
  failedCount?: number;
}

export interface AdminCustomerDetail extends AdminCustomerListItem {
  subscriptions: Subscription[];
  licenses: License[];
  devices: DeviceRegistration[];
  invoices: PaymentInvoice[];
  receipts: PaymentTransaction[];
  financialSyncStatus: AdminCustomerFinancialSyncStatus | null;
}

/** Badge variant helper - keeps status -> color mapping in one place. */
export function adminCustomerStatusVariant(
  status: string | undefined,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "destructive";
    default:
      return "default";
  }
}
