import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentTransactionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentEventDispatcherService } from "./payment-event-dispatcher.service";
import type { CreateManualTransactionDto } from "./dto/create-manual-transaction.dto";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: PaymentEventDispatcherService,
  ) {}

  /** Records a transaction for a provider with no webhook of its own (Manual/BankTransfer) - an admin reconciles it by hand. */
  async createManual(organizationId: string, dto: CreateManualTransactionDto) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: dto.customerId },
    });
    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Customer not found in this organization");
    }

    return this.prisma.paymentTransaction.create({
      data: {
        providerId: dto.providerId,
        customerId: dto.customerId,
        subscriptionId: dto.subscriptionId,
        amountMinor: dto.amountMinor,
        currency: dto.currency.toUpperCase(),
        status: PaymentTransactionStatus.PENDING,
        providerTransactionId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        metadata: dto.metadata,
      },
    });
  }

  /** Marks a manually-recorded transaction as succeeded, driving the same dispatch path a webhook would. */
  async markSucceeded(transactionId: string, organizationId: string) {
    const transaction = await this.getOwned(transactionId, organizationId);
    if (!transaction.providerTransactionId) {
      throw new NotFoundException("Transaction has no provider reference");
    }

    const subscription = transaction.subscriptionId
      ? await this.prisma.subscription.findUnique({ where: { id: transaction.subscriptionId } })
      : null;

    await this.dispatcher.dispatch(transaction.providerId, organizationId, {
      type: "PAYMENT_SUCCEEDED",
      externalEventId: `manual_success_${transactionId}`,
      externalTransactionId: transaction.providerTransactionId,
      externalSubscriptionId: subscription?.providerSubscriptionId ?? undefined,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      occurredAt: new Date(),
      raw: {},
    });

    return this.getOwned(transactionId, organizationId);
  }

  async list(organizationId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { customer: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { attempts: true, refunds: true, disputes: true },
    });
  }

  async getOne(transactionId: string, organizationId: string) {
    return this.getOwned(transactionId, organizationId, true);
  }

  private async getOwned(transactionId: string, organizationId: string, withRelations = false) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: withRelations
        ? { attempts: true, refunds: true, disputes: true, receipts: true }
        : undefined,
    });
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: transaction.customerId },
    });
    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Transaction not found");
    }
    return transaction;
  }
}
