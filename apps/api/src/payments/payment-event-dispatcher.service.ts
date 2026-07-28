import { Injectable, Logger } from "@nestjs/common";
import {
  CouponDiscountType,
  FinancialEventType,
  PaymentDisputeStatus,
  PaymentTransactionStatus,
  type Prisma,
  type PaymentTransaction,
  type Subscription,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { SystemActorService } from "./system-actor.service";
import { FinancialEventsService } from "../financial-events/financial-events.service";
import type { NormalizedPaymentEvent } from "./adapters/payment-provider.adapter";

const SYSTEM_META = {};
const ACTIVE_LIKE_STATUSES = new Set(["ACTIVE", "PAST_DUE", "GRACE_PERIOD"]);
const PRE_ACTIVATION_STATUSES = new Set(["INCOMPLETE", "TRIALING"]);

/**
 * The only place a normalized payment event turns into a subscription
 * state change. Called from the webhook pipeline and (for providers with
 * no webhooks, i.e. Manual/BankTransfer) from a manual "mark succeeded"
 * admin action - both paths funnel through here so the rule "only the
 * Subscription Engine changes subscription status" holds no matter how
 * the event arrived. This dispatcher never writes `Subscription.status`
 * itself - it only calls `SubscriptionsService`'s public lifecycle methods.
 *
 * It is also the ONLY place that turns a payment/subscription outcome into
 * a `FinancialEventsService.record()` call for the categories that
 * originate from a payment provider or a manual confirmation (initial
 * payment, renewal, refund/partial refund, chargeback/reversal, payment
 * failure, manual confirmation). Upgrade-payment and proration-charge
 * financial events are recorded separately, in
 * `SubscriptionsService.applyChange()`'s immediate-proration branch - that
 * is the one place in the codebase that actually computes a proration
 * amount, and duplicating that computation here would drift out of sync
 * with it. Every `FinancialEventsService.record()` call below carries an
 * `idempotencyKey` derived from a stable identity (a `PaymentTransaction`
 * id, a `PaymentRefund`/`PaymentDispute` id) so a retried webhook or a
 * doubly-invoked manual action never double-books revenue - on top of the
 * `PaymentWebhook` table's own `[providerId, externalEventId]` dedup.
 */
@Injectable()
export class PaymentEventDispatcherService {
  private readonly logger = new Logger(PaymentEventDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly systemActor: SystemActorService,
    private readonly financialEventsService: FinancialEventsService,
  ) {}

  async dispatch(
    providerId: string,
    organizationId: string,
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    let subscription = event.externalSubscriptionId
      ? await this.prisma.subscription.findFirst({
          where: { organizationId, providerSubscriptionId: event.externalSubscriptionId },
        })
      : null;

    const transaction = await this.upsertTransaction(
      providerId,
      organizationId,
      event,
      subscription?.id,
    );

    // Manual/BankTransfer transactions carry `subscriptionId` directly (no
    // `providerSubscriptionId` ever gets set for them, since there's no
    // external provider subscription) - fall back to that direct link
    // rather than leaving the subscription unresolved.
    if (!subscription && transaction?.subscriptionId) {
      subscription = await this.prisma.subscription.findUnique({
        where: { id: transaction.subscriptionId },
      });
    }

    const systemUserId = await this.systemActor.getSystemUserId();

    try {
      switch (event.type) {
        case "PAYMENT_SUCCEEDED": {
          const preStatus = subscription?.status;
          if (transaction) {
            await this.prisma.paymentTransaction.update({
              where: { id: transaction.id },
              data: { status: PaymentTransactionStatus.SUCCEEDED },
            });
          }
          if (subscription) {
            await this.recoverOrRenew(subscription.id, subscription.status, systemUserId);
          }
          if (transaction) {
            await this.recordPaymentSucceeded(
              organizationId,
              providerId,
              transaction,
              subscription,
              preStatus,
            );
          }
          break;
        }

        case "PAYMENT_FAILED": {
          if (transaction) {
            await this.prisma.paymentTransaction.update({
              where: { id: transaction.id },
              data: {
                status: PaymentTransactionStatus.FAILED,
                failureReason: "provider_reported_failure",
              },
            });
          }
          if (subscription && subscription.status === "ACTIVE") {
            await this.subscriptionsService.markPastDue(
              subscription.id,
              systemUserId,
              {},
              SYSTEM_META,
            );
          }
          if (transaction) {
            await this.financialEventsService.record(
              organizationId,
              FinancialEventType.PAYMENT_FAILED,
              await this.buildPayload(transaction, subscription, { reason: "payment_failed" }),
              {
                applicationId: subscription?.applicationId,
                customerId: transaction.customerId,
                subscriptionId: subscription?.id,
              },
              systemUserId,
              SYSTEM_META,
              `payment_failed:${transaction.id}:${event.externalEventId}`,
            );
          }
          break;
        }

        case "SUBSCRIPTION_RENEWED": {
          if (subscription) {
            const preStatus = subscription.status;
            await this.recoverOrRenew(subscription.id, subscription.status, systemUserId);
            // Only record here when no PaymentTransaction accompanied this
            // event - if one did, `PAYMENT_SUCCEEDED` already recorded the
            // financial event for this same renewal (see the comment atop
            // this class for why two webhooks for one renewal must not
            // double-book revenue).
            if (!transaction) {
              await this.recordRenewalWithoutTransaction(
                organizationId,
                subscription,
                preStatus,
                systemUserId,
              );
            }
          }
          break;
        }

        case "SUBSCRIPTION_CANCELED":
          if (subscription && subscription.status !== "CANCELED") {
            await this.subscriptionsService.cancel(subscription.id, systemUserId, {}, SYSTEM_META);
          }
          break;

        case "SUBSCRIPTION_EXPIRED":
          if (subscription && subscription.status !== "EXPIRED") {
            await this.subscriptionsService.expire(subscription.id, systemUserId, {}, SYSTEM_META);
          }
          break;

        case "SUBSCRIPTION_PAST_DUE":
          if (subscription && subscription.status === "ACTIVE") {
            await this.subscriptionsService.markPastDue(
              subscription.id,
              systemUserId,
              {},
              SYSTEM_META,
            );
          }
          break;

        case "REFUND_CREATED":
        case "REFUND_COMPLETED":
          if (transaction) {
            await this.applyRefund(organizationId, transaction, subscription, event, systemUserId);
          }
          break;

        case "CHARGEBACK_CREATED":
          if (transaction) {
            await this.applyChargeback(
              organizationId,
              transaction,
              subscription,
              event,
              systemUserId,
            );
          }
          break;

        case "DISPUTE_UPDATED":
          if (transaction && event.disputeStatus) {
            await this.applyDisputeUpdate(
              organizationId,
              transaction,
              subscription,
              event,
              systemUserId,
            );
          }
          break;

        case "PAYMENT_PENDING":
        case "UNKNOWN":
          break;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to apply subscription transition for event ${event.type} (${event.externalEventId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private async recoverOrRenew(
    subscriptionId: string,
    status: string,
    systemUserId: string,
  ): Promise<void> {
    if (PRE_ACTIVATION_STATUSES.has(status)) {
      await this.subscriptionsService.activate(subscriptionId, systemUserId, {}, SYSTEM_META);
      return;
    }
    if (ACTIVE_LIKE_STATUSES.has(status)) {
      await this.subscriptionsService.renew(subscriptionId, systemUserId, {}, SYSTEM_META);
    }
  }

  private async upsertTransaction(
    providerId: string,
    organizationId: string,
    event: NormalizedPaymentEvent,
    subscriptionId?: string,
  ) {
    if (!event.externalTransactionId) {
      return null;
    }

    const existing = await this.prisma.paymentTransaction.findUnique({
      where: {
        providerId_providerTransactionId: {
          providerId,
          providerTransactionId: event.externalTransactionId,
        },
      },
    });
    if (existing) {
      return existing;
    }
    if (event.amountMinor === undefined || !event.currency) {
      return null;
    }

    let customerId: string | undefined;
    if (subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      customerId = subscription?.customerId;
    }
    if (!customerId && event.externalCustomerId) {
      const paymentCustomer = await this.prisma.paymentCustomer.findFirst({
        where: { providerId, externalCustomerId: event.externalCustomerId },
      });
      customerId = paymentCustomer?.customerId;
    }
    if (!customerId) {
      const fallback = await this.prisma.customer.findFirst({ where: { organizationId } });
      customerId = fallback?.id;
    }
    if (!customerId) {
      return null;
    }

    return this.prisma.paymentTransaction.create({
      data: {
        providerId,
        customerId,
        subscriptionId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        status: PaymentTransactionStatus.PENDING,
        providerTransactionId: event.externalTransactionId,
      },
    });
  }

  // ---- financial event recording ----

  private async recordPaymentSucceeded(
    organizationId: string,
    providerId: string,
    transaction: PaymentTransaction,
    subscription: Subscription | null,
    preStatus: string | undefined,
  ): Promise<void> {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id: providerId } });
    const manual = provider?.type === "MANUAL" || provider?.type === "BANK_TRANSFER";
    const isInitial = preStatus !== undefined && PRE_ACTIVATION_STATUSES.has(preStatus);

    const type = isInitial
      ? FinancialEventType.SUBSCRIPTION_ACTIVATED
      : FinancialEventType.SUBSCRIPTION_RENEWED;
    const reason = manual ? "manual_confirmation" : isInitial ? "initial_payment" : "renewal";

    await this.financialEventsService.record(
      organizationId,
      type,
      await this.buildPayload(transaction, subscription, { reason }),
      {
        applicationId: subscription?.applicationId,
        customerId: transaction.customerId,
        subscriptionId: subscription?.id,
      },
      undefined,
      SYSTEM_META,
      `payment_succeeded:${transaction.id}`,
    );
  }

  private async recordRenewalWithoutTransaction(
    organizationId: string,
    subscription: Subscription,
    preStatus: string,
    systemUserId: string,
  ): Promise<void> {
    const type = PRE_ACTIVATION_STATUSES.has(preStatus)
      ? FinancialEventType.SUBSCRIPTION_ACTIVATED
      : FinancialEventType.SUBSCRIPTION_RENEWED;
    const periodKey =
      subscription.currentPeriodEnd?.toISOString() ?? subscription.updatedAt.toISOString();

    await this.financialEventsService.record(
      organizationId,
      type,
      {
        reason: PRE_ACTIVATION_STATUSES.has(preStatus) ? "initial_payment" : "renewal",
        subscriptionId: subscription.id,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
      {
        applicationId: subscription.applicationId,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
      },
      systemUserId,
      SYSTEM_META,
      `subscription_renewed:${subscription.id}:${periodKey}`,
    );
  }

  private async applyRefund(
    organizationId: string,
    transaction: PaymentTransaction,
    subscription: Subscription | null,
    event: NormalizedPaymentEvent,
    systemUserId: string,
  ): Promise<void> {
    const refundAmount = event.amountMinor ?? transaction.amountMinor;
    const isFull = refundAmount >= transaction.amountMinor;

    const refund = await this.prisma.paymentRefund.create({
      data: {
        transactionId: transaction.id,
        amountMinor: refundAmount,
        currency: event.currency ?? transaction.currency,
        status: "SUCCEEDED",
        providerRefundId: event.externalEventId,
      },
    });

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: isFull
          ? PaymentTransactionStatus.REFUNDED
          : PaymentTransactionStatus.PARTIALLY_REFUNDED,
      },
    });

    await this.financialEventsService.record(
      organizationId,
      isFull ? FinancialEventType.REFUND_ISSUED : FinancialEventType.REFUND_PARTIAL,
      await this.buildPayload(transaction, subscription, {
        reason: isFull ? "refund" : "partial_refund",
        refundId: refund.id,
        refundAmountMinor: refundAmount,
      }),
      {
        applicationId: subscription?.applicationId,
        customerId: transaction.customerId,
        subscriptionId: subscription?.id,
      },
      systemUserId,
      SYSTEM_META,
      `refund:${refund.id}`,
    );
  }

  private async applyChargeback(
    organizationId: string,
    transaction: PaymentTransaction,
    subscription: Subscription | null,
    event: NormalizedPaymentEvent,
    systemUserId: string,
  ): Promise<void> {
    const dispute = await this.prisma.paymentDispute.create({
      data: {
        transactionId: transaction.id,
        providerDisputeId: event.externalEventId,
        amountMinor: event.amountMinor ?? 0,
        currency: event.currency ?? transaction.currency,
      },
    });

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: PaymentTransactionStatus.CHARGEBACK },
    });

    await this.financialEventsService.record(
      organizationId,
      FinancialEventType.CHARGEBACK_CREATED,
      await this.buildPayload(transaction, subscription, {
        reason: "chargeback",
        disputeId: dispute.id,
        chargebackAmountMinor: dispute.amountMinor,
      }),
      {
        applicationId: subscription?.applicationId,
        customerId: transaction.customerId,
        subscriptionId: subscription?.id,
      },
      systemUserId,
      SYSTEM_META,
      `chargeback:${dispute.id}`,
    );
  }

  private async applyDisputeUpdate(
    organizationId: string,
    transaction: PaymentTransaction,
    subscription: Subscription | null,
    event: NormalizedPaymentEvent,
    systemUserId: string,
  ): Promise<void> {
    const dispute = await this.prisma.paymentDispute.findFirst({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "desc" },
    });
    if (!dispute) {
      return;
    }

    const status =
      event.disputeStatus === "WON"
        ? PaymentDisputeStatus.WON
        : event.disputeStatus === "LOST"
          ? PaymentDisputeStatus.LOST
          : PaymentDisputeStatus.UNDER_REVIEW;

    await this.prisma.paymentDispute.update({ where: { id: dispute.id }, data: { status } });

    if (status !== PaymentDisputeStatus.WON) {
      // LOST leaves the transaction's CHARGEBACK status as-is (already
      // recorded); UNDER_REVIEW is just a status ping - neither is a new
      // financial event.
      return;
    }

    // WON = a chargeback reversal: the merchant keeps the funds, so the
    // transaction's status reverts from CHARGEBACK back to SUCCEEDED.
    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: PaymentTransactionStatus.SUCCEEDED },
    });

    await this.financialEventsService.record(
      organizationId,
      FinancialEventType.CHARGEBACK_REVERSED,
      await this.buildPayload(transaction, subscription, {
        reason: "chargeback_reversed",
        disputeId: dispute.id,
      }),
      {
        applicationId: subscription?.applicationId,
        customerId: transaction.customerId,
        subscriptionId: subscription?.id,
      },
      systemUserId,
      SYSTEM_META,
      `chargeback_reversed:${dispute.id}`,
    );
  }

  /** Builds the `FinancialEvent.payload` shape `SyncEngineService` reads
   * (`amountMinor`/`currency`/`description`/`customerReference`) plus
   * transaction/subscription refs, discount (best-effort, from any active
   * `SubscriptionCoupon`), and tax (always 0 - no tax engine exists in this
   * platform; the field is present for schema/ERP-payload readiness). */
  private async buildPayload(
    transaction: PaymentTransaction,
    subscription: Subscription | null,
    extra: Record<string, string | number | boolean | null>,
  ): Promise<Prisma.InputJsonValue> {
    const discountMinor = subscription
      ? await this.computeDiscountMinor(subscription.id, transaction.amountMinor)
      : 0;

    return {
      ...extra,
      transactionId: transaction.id,
      providerTransactionId: transaction.providerTransactionId,
      providerId: transaction.providerId,
      subscriptionId: subscription?.id ?? null,
      customerReference: transaction.customerId,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      taxMinor: 0,
      discountMinor,
      description: subscription
        ? `Subscription ${subscription.id}`
        : `Transaction ${transaction.id}`,
      method: "provider",
      reference: transaction.providerTransactionId,
    };
  }

  private async computeDiscountMinor(subscriptionId: string, amountMinor: number): Promise<number> {
    const applied = await this.prisma.subscriptionCoupon.findMany({
      where: { subscriptionId, removedAt: null },
      include: { coupon: true },
    });

    return applied.reduce((total, { coupon }) => {
      if (coupon.discountType === CouponDiscountType.FIXED) {
        return total + (coupon.amountOffMinor ?? 0);
      }
      return total + Math.round((amountMinor * (coupon.percentOff ?? 0)) / 100);
    }, 0);
  }
}
