import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CommissionLedgerStatus, PayoutStatus, type Payout } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";

export interface AccruedSummary {
  organizationId: string;
  currency: string;
  totalVendorPayoutAmountMinor: number;
  entryCount: number;
}

/**
 * Manual payout flow (no automated bank transfer yet - see merge plan
 * checkpoint 5). An admin creates a `Payout` covering an organization's
 * currently-unclaimed ACCRUED entries (grouped by currency - a vendor
 * selling in two currencies gets one payout per currency, a documented
 * simplification), then separately marks it paid once the transfer has
 * actually happened outside this system.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** ACCRUED entries not yet claimed by any payout (`payoutId` null), grouped by organization + currency. */
  async listAccrued(): Promise<AccruedSummary[]> {
    const grouped = await this.prisma.commissionLedgerEntry.groupBy({
      by: ["organizationId", "currency"],
      where: { status: CommissionLedgerStatus.ACCRUED, payoutId: null },
      _sum: { vendorPayoutAmountMinor: true },
      _count: { _all: true },
    });

    return grouped.map((g) => ({
      organizationId: g.organizationId,
      currency: g.currency,
      totalVendorPayoutAmountMinor: g._sum.vendorPayoutAmountMinor ?? 0,
      entryCount: g._count._all,
    }));
  }

  async listForOrganization(organizationId: string): Promise<Payout[]> {
    return this.prisma.payout.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Creates one `Payout` per currency the organization has unclaimed
   * ACCRUED entries in, and claims those entries (`payoutId` set) so a
   * second call right after doesn't double-claim them. Entries stay
   * ACCRUED until `markPaid` actually confirms the transfer happened.
   */
  async createForOrganization(
    organizationId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<Payout[]> {
    const unclaimed = await this.prisma.commissionLedgerEntry.findMany({
      where: { organizationId, status: CommissionLedgerStatus.ACCRUED, payoutId: null },
    });

    if (unclaimed.length === 0) {
      throw new BadRequestException(
        "No unclaimed accrued commission entries for this organization",
      );
    }

    const byCurrency = new Map<string, typeof unclaimed>();
    for (const entry of unclaimed) {
      const bucket = byCurrency.get(entry.currency) ?? [];
      bucket.push(entry);
      byCurrency.set(entry.currency, bucket);
    }

    const now = new Date();
    const payouts: Payout[] = [];

    for (const [currency, entries] of byCurrency) {
      const amountMinor = entries.reduce((sum, e) => sum + e.vendorPayoutAmountMinor, 0);

      const payout = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payout.create({
          data: {
            organizationId,
            amountMinor,
            currency,
            periodStart: entries.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), now),
            periodEnd: now,
          },
        });

        await tx.commissionLedgerEntry.updateMany({
          where: { id: { in: entries.map((e) => e.id) } },
          data: { payoutId: created.id },
        });

        return created;
      });

      payouts.push(payout);

      await this.auditService.record({
        action: "PAYOUT_CREATED",
        userId,
        organizationId,
        metadata: { payoutId: payout.id, amountMinor, currency, entryCount: entries.length },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return payouts;
  }

  /** Marks a payout paid once the actual bank transfer has happened
   * outside this system - also flips its linked entries to PAID. */
  async markPaid(payoutId: string, userId: string, meta: RequestMeta): Promise<Payout> {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException("Payout not found");
    }
    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException("Payout is already marked paid");
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.PAID, paidAt: new Date(), markedPaidById: userId },
      }),
      this.prisma.commissionLedgerEntry.updateMany({
        where: { payoutId },
        data: { status: CommissionLedgerStatus.PAID },
      }),
    ]);

    await this.auditService.record({
      action: "PAYOUT_MARKED_PAID",
      userId,
      organizationId: payout.organizationId,
      metadata: { payoutId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
