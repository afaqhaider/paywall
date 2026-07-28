export type FinancialProvider = "INTERNAL" | "LEDGIX_ERP";

export type ErpConnectionStatus =
  "NOT_CONFIGURED" | "PENDING_TEST" | "CONNECTED" | "FAILED" | "DISCONNECTED";

export type ERPResourceType =
  | "CUSTOMERS"
  | "SUPPLIERS"
  | "INVOICES"
  | "RECEIPTS"
  | "BANKS"
  | "PAYMENT_GATEWAYS"
  | "CURRENCIES"
  | "TAXES"
  | "COMPANY"
  | "CHART_OF_ACCOUNTS"
  | "PAYMENT_METHODS";

export interface ErpPermission {
  id?: string;
  resource: ERPResourceType;
  canRead: boolean;
  canWrite: boolean;
}

export interface ErpCompany {
  externalCompanyId: string;
  name: string;
  baseCurrency: string;
}

export interface ErpConnection {
  id: string;
  baseUrl: string;
  companyId: string;
  lastFour: string | null;
  apiVersion: string | null;
  status: ErpConnectionStatus;
  lastTestedAt: string | null;
  lastSyncedAt: string | null;
  company: ErpCompany | null;
  configuration: {
    permissions: ErpPermission[];
  };
}

export interface FinancialIntegration {
  organizationId: string;
  provider: FinancialProvider;
  erpConnection: ErpConnection | null;
}

export interface ErpConnectionTestResult {
  status: "CONNECTED" | "FAILED";
  testedAt: string;
  company?: ErpCompany;
  error?: string;
}

export const ERP_RESOURCE_TYPES: ERPResourceType[] = [
  "CUSTOMERS",
  "SUPPLIERS",
  "INVOICES",
  "RECEIPTS",
  "BANKS",
  "PAYMENT_GATEWAYS",
  "CURRENCIES",
  "TAXES",
  "COMPANY",
  "CHART_OF_ACCOUNTS",
  "PAYMENT_METHODS",
];

const ERP_RESOURCE_LABELS: Record<ERPResourceType, string> = {
  CUSTOMERS: "Customers",
  SUPPLIERS: "Suppliers",
  INVOICES: "Invoices",
  RECEIPTS: "Receipts",
  BANKS: "Banks",
  PAYMENT_GATEWAYS: "Payment Gateways",
  CURRENCIES: "Currencies",
  TAXES: "Taxes",
  COMPANY: "Company",
  CHART_OF_ACCOUNTS: "Chart of Accounts",
  PAYMENT_METHODS: "Payment Methods",
};

export function erpResourceLabel(resource: ERPResourceType): string {
  return ERP_RESOURCE_LABELS[resource];
}

/** Badge variant helper - keeps status -> color mapping in one place. Only
 * "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function erpStatusVariant(
  status: ErpConnectionStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "FAILED":
    case "DISCONNECTED":
      return "destructive";
    case "PENDING_TEST":
      return "outline";
    default:
      return "default";
  }
}
