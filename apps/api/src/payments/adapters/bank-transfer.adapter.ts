import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateProviderSubscriptionResult,
  NormalizedPaymentEvent,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  SyncSubscriptionResult,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

/**
 * Offline wire/IBAN transfer. "Checkout" here isn't a hosted page - it's a
 * reference an admin later reconciles against a bank statement, so
 * `checkoutUrl` carries the org's configured bank instructions
 * (`account.metadata`/`config`) rather than a real redirect target.
 * Reconciliation (marking the resulting `PaymentTransaction` succeeded) is
 * a manual admin action, same as the Manual adapter.
 */
@Injectable()
export class BankTransferAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.BANK_TRANSFER;

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return { externalCustomerId: `bank_${input.customerId}` };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const reference = `BT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const instructions = input.account?.metadata ?? {};
    return {
      checkoutUrl: `about:blank#bank-transfer-instructions:${encodeURIComponent(JSON.stringify(instructions))}`,
      providerReference: reference,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createSubscription");
  }

  async cancelSubscription(): Promise<void> {
    // Nothing external to cancel.
  }

  async resumeSubscription(): Promise<void> {
    // No-op.
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { externalRefundId: `bank_refund_${input.externalTransactionId}`, status: "PENDING" };
  }

  async syncSubscription(): Promise<SyncSubscriptionResult> {
    return { status: "UNKNOWN" };
  }

  async verifyPurchase(): Promise<VerifyPurchaseResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "verifyPurchase");
  }

  verifyWebhook(): boolean {
    return true;
  }

  normalizeWebhookEvent(): NormalizedPaymentEvent[] {
    return [];
  }
}
