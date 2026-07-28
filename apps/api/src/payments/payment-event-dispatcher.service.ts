import { Injectable, Logger } from "@nestjs/common";
import { PaymentTransactionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { SystemActorService } from "./system-actor.service";
import type { NormalizedPaymentEvent } from "./adapters/payment-provider.adapter";

const SYSTEM_META = {};

/**
 * The only place a normalized payment event turns into a subscription
 * state change. Called from the webhook pipeline and (for providers with
 * no webhooks, i.e. Manual/BankTransfer) from a manual "mark succeeded"
 * admin action - both paths funnel through here so the rule "only the
 * Subscription Engine changes subscription status" holds no matter how
 * the event arrived. This dispatcher never writes `Subscription.status`
 * itself - it only calls `SubscriptionsService`'s public lifecycle methods.
 */
@Injectable()
export class PaymentEventDispatcherService {
  private readonly logger = new Logger(PaymentEventDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly systemActor: SystemActorService,
  ) {}

  async dispatch(
    providerId: string,
    organizationId: string,
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    const subscription = event.externalSubscriptionId
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

    const systemUserId = await this.systemActor.getSystemUserId();

    try {
      switch (event.type) {
        case "PAYMENT_SUCCEEDED":
          if (transaction) {
            await this.prisma.paymentTransaction.update({
              where: { id: transaction.id },
              data: { status: PaymentTransactionStatus.SUCCEEDED },
            });
          }
          if (subscription) {
            await this.recoverOrRenew(subscription.id, subscription.status, systemUserId);
          }
          break;

        case "PAYMENT_FAILED":
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
          break;

        case "SUBSCRIPTION_RENEWED":
          if (subscription) {
            await this.recoverOrRenew(subscription.id, subscription.status, systemUserId);
          }
          break;

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
            await this.applyRefund(transaction.id, transaction.amountMinor, event);
          }
          break;

        case "CHARGEBACK_CREATED":
          if (transaction) {
            await this.applyChargeback(transaction.id, event);
          }
          break;

        case "DISPUTE_UPDATED":
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
    if (status === "INCOMPLETE" || status === "TRIALING") {
      await this.subscriptionsService.activate(subscriptionId, systemUserId, {}, SYSTEM_META);
      return;
    }
    if (status === "ACTIVE" || status === "PAST_DUE" || status === "GRACE_PERIOD") {
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

  private async applyRefund(
    transactionId: string,
    originalAmountMinor: number,
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    const refundAmount = event.amountMinor ?? originalAmountMinor;

    await this.prisma.paymentRefund.create({
      data: {
        transactionId,
        amountMinor: refundAmount,
        currency: event.currency ?? "USD",
        status: "SUCCEEDED",
        providerRefundId: event.externalEventId,
      },
    });

    await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status:
          refundAmount >= originalAmountMinor
            ? PaymentTransactionStatus.REFUNDED
            : PaymentTransactionStatus.PARTIALLY_REFUNDED,
      },
    });
  }

  private async applyChargeback(
    transactionId: string,
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    await this.prisma.paymentDispute.create({
      data: {
        transactionId,
        providerDisputeId: event.externalEventId,
        amountMinor: event.amountMinor ?? 0,
        currency: event.currency ?? "USD",
      },
    });

    await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: PaymentTransactionStatus.CHARGEBACK },
    });
  }
}
