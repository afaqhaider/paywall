import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import type {
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
 * The "no real gateway" provider: an administrator records that money
 * changed hands offline (cash, wire, informal arrangement) and the
 * subscription is managed entirely by hand. Every operation either
 * succeeds trivially or is a documented no-op - there is nothing external
 * to call, verify, or reconcile.
 */
@Injectable()
export class ManualAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.MANUAL;

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return { externalCustomerId: `manual_${input.customerId}` };
  }

  async createCheckout(): Promise<CreateCheckoutResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createCheckout");
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createSubscription");
  }

  async cancelSubscription(): Promise<void> {
    // Nothing external to cancel - the Subscription Engine's own state is authoritative.
  }

  async resumeSubscription(): Promise<void> {
    // No-op for the same reason.
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      externalRefundId: `manual_refund_${input.externalTransactionId}`,
      status: "SUCCEEDED",
    };
  }

  async syncSubscription(): Promise<SyncSubscriptionResult> {
    return { status: "UNKNOWN" };
  }

  async verifyPurchase(): Promise<VerifyPurchaseResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "verifyPurchase");
  }

  verifyWebhook(): boolean {
    // Manual never receives webhooks.
    return true;
  }

  normalizeWebhookEvent(): NormalizedPaymentEvent[] {
    return [];
  }
}
