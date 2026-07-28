import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentRefundStatus, PaymentTransactionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { ProviderResolverService } from "./provider-resolver.service";
import type { CreateRefundDto } from "./dto/create-refund.dto";

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly resolver: ProviderResolverService,
  ) {}

  async create(
    transactionId: string,
    organizationId: string,
    userId: string,
    dto: CreateRefundDto,
    meta: RequestMeta,
  ) {
    const transaction = await this.getOwnedTransaction(transactionId, organizationId);
    const { adapter, credentials, account } = await this.resolver.resolve(transaction.providerId);

    if (!transaction.providerTransactionId) {
      throw new NotFoundException("Transaction has no provider reference to refund");
    }

    const result = await adapter.refund({
      externalTransactionId: transaction.providerTransactionId,
      amountMinor: dto.amountMinor,
      reason: dto.reason,
      credentials,
      account,
    });

    const refund = await this.prisma.paymentRefund.create({
      data: {
        transactionId,
        amountMinor: dto.amountMinor ?? transaction.amountMinor,
        currency: transaction.currency,
        reason: dto.reason,
        status:
          result.status === "SUCCEEDED"
            ? PaymentRefundStatus.SUCCEEDED
            : result.status === "FAILED"
              ? PaymentRefundStatus.FAILED
              : PaymentRefundStatus.PENDING,
        providerRefundId: result.externalRefundId,
        createdById: userId,
      },
    });

    if (result.status === "SUCCEEDED") {
      const refundedAmount = dto.amountMinor ?? transaction.amountMinor;
      await this.prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status:
            refundedAmount >= transaction.amountMinor
              ? PaymentTransactionStatus.REFUNDED
              : PaymentTransactionStatus.PARTIALLY_REFUNDED,
        },
      });
    }

    await this.auditService.record({
      action: "PAYMENT_REFUND_CREATED",
      userId,
      organizationId,
      metadata: { transactionId, refundId: refund.id },
      ...meta,
    });

    return refund;
  }

  async list(organizationId: string) {
    return this.prisma.paymentRefund.findMany({
      where: { transaction: { customer: { organizationId } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  private async getOwnedTransaction(transactionId: string, organizationId: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
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
