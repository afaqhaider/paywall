import type { PaymentTransaction } from "./payments-types";

export interface AdminPaymentListItem extends PaymentTransaction {
  organizationName?: string;
}
