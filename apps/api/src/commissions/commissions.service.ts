import { Injectable, Logger } from "@nestjs/common";
import {
  CommissionLedgerStatus,
  type CommissionLedgerEntry,
  type CommissionRule,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeCommissionSplit, reverseCommissionSplit } from "./commission-calculator.util";

/**
 * The only place that writes `CommissionLedgerEntry` rows. Resolution order
 * for which `CommissionRule` applies to a sale: application-specific ->
 * organization-specific -> platform default (both `organizationId` and
 * `applicationId` null on the rule). If none exist at all - including no
 * platform default - this deliberately does NOT fabricate a rate; it logs
 * and skips, because guessing a commission percentage would silently
 * misstate real revenue. An admin must seed at least a platform default
 * rule before commission recording does anything.
 */
@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveRule(
    organizationId: string,
    applicationId?: string | null,
  ): Promise<CommissionRule | null> {
    const now = new Date();
    const activeWindow = {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    };

    if (applicationId) {
      const appRule = await this.prisma.commissionRule.findFirst({
        where: { applicationId, ...activeWindow },
        orderBy: { effectiveFrom: "desc" },
      });
      if (appRule) return appRule;
    }

    const orgRule = await this.prisma.commissionRule.findFirst({
      where: { organizationId, applicationId: null, ...activeWindow },
      orderBy: { effectiveFrom: "desc" },
    });
    if (orgRule) return orgRule;

    return this.prisma.commissionRule.findFirst({
      where: { organizationId: null, applicationId: null, ...activeWindow },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  /**
   * Records the commission split for a successful payment. Idempotent - a
   * transaction can only ever have one ACCRUED entry (checked before
   * insert), so a retried `PAYMENT_SUCCEEDED` event never double-books
   * commission. Returns null (does not throw) when no rule is configured,
   * so this never breaks the payment flow that calls it.
   */
  async recordForTransaction(
    transactionId: string,
    organizationId: string,
    applicationId: string | null,
    grossAmountMinor: number,
    currency: string,
  ): Promise<CommissionLedgerEntry | null> {
    const existing = await this.prisma.commissionLedgerEntry.findFirst({
      where: { paymentTransactionId: transactionId, status: CommissionLedgerStatus.ACCRUED },
    });
    if (existing) {
      return existing;
    }

    const rule = await this.resolveRule(organizationId, applicationId);
    if (!rule) {
      this.logger.warn(
        `No commission rule configured (no platform default) - skipping commission ledger entry for transaction ${transactionId}`,
      );
      return null;
    }

    const split = computeCommissionSplit(grossAmountMinor, {
      ratePercent: Number(rule.ratePercent),
      flatFeeMinor: rule.flatFeeMinor,
    });

    return this.prisma.commissionLedgerEntry.create({
      data: {
        paymentTransactionId: transactionId,
        organizationId,
        ruleId: rule.id,
        currency,
        ...split,
      },
    });
  }

  /**
   * Reverses a transaction's ACCRUED commission entry for a refund/
   * chargeback - creates a linked negative entry, never mutates the
   * original (see the schema comment on `CommissionLedgerEntry`).
   */
  async reverseForTransaction(transactionId: string): Promise<CommissionLedgerEntry | null> {
    const original = await this.prisma.commissionLedgerEntry.findFirst({
      where: { paymentTransactionId: transactionId, status: CommissionLedgerStatus.ACCRUED },
    });
    if (!original) {
      this.logger.warn(
        `No ACCRUED commission entry found to reverse for transaction ${transactionId}`,
      );
      return null;
    }

    const negated = reverseCommissionSplit({
      grossAmountMinor: original.grossAmountMinor,
      commissionAmountMinor: original.commissionAmountMinor,
      vendorPayoutAmountMinor: original.vendorPayoutAmountMinor,
    });

    const [, reversal] = await this.prisma.$transaction([
      this.prisma.commissionLedgerEntry.update({
        where: { id: original.id },
        data: { status: CommissionLedgerStatus.REVERSED },
      }),
      this.prisma.commissionLedgerEntry.create({
        data: {
          paymentTransactionId: original.paymentTransactionId,
          organizationId: original.organizationId,
          ruleId: original.ruleId,
          currency: original.currency,
          reversalOfId: original.id,
          status: CommissionLedgerStatus.REVERSED,
          ...negated,
        },
      }),
    ]);

    return reversal;
  }
}
