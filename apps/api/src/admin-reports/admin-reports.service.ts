import { Injectable } from "@nestjs/common";
import {
  ApplicationStatus,
  ERPConnectionStatus,
  FinancialProviderType,
  OrganizationStatus,
  PaymentTransactionStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface MonthlyCountRow {
  period: Date;
  count: bigint | number;
}

interface DailyCountRow {
  period: Date;
  count: bigint | number;
}

interface MonthlyRevenueRow {
  period: Date;
  totalMinor: bigint | number | null;
}

export interface MonthlyPoint {
  period: string; // "YYYY-MM"
  count: number;
}

export interface DailyPoint {
  period: string; // "YYYY-MM-DD"
  count: number;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function last30Days(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}

function last12Months(): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 12);
  return d;
}

/**
 * Platform-wide aggregate counts for the Reporting surface. Every method
 * here is intentionally cheap - a handful of `count()`/`groupBy()` calls
 * (or a single `date_trunc` raw query mirroring
 * `analytics/analytics.service.ts`'s established pattern), never a heavy
 * join across the whole dataset.
 */
@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async organizations() {
    const [byStatus, total, createdLast30Days] = await Promise.all([
      this.prisma.organization.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { createdAt: { gte: last30Days() } } }),
    ]);

    const countFor = (status: OrganizationStatus) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    return {
      total,
      active: countFor(OrganizationStatus.ACTIVE),
      suspended: countFor(OrganizationStatus.SUSPENDED),
      archived: countFor(OrganizationStatus.ARCHIVED),
      createdLast30Days,
    };
  }

  async applications() {
    const [byStatus, total, createdLast30Days] = await Promise.all([
      this.prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.application.count(),
      this.prisma.application.count({ where: { createdAt: { gte: last30Days() } } }),
    ]);

    const countFor = (status: ApplicationStatus) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    return {
      total,
      active: countFor(ApplicationStatus.ACTIVE),
      suspended: countFor(ApplicationStatus.SUSPENDED),
      archived: countFor(ApplicationStatus.ARCHIVED),
      createdLast30Days,
    };
  }

  /** Sum of `amountMinor` for SUCCEEDED payments, grouped by month, last 12 months. */
  async revenue(): Promise<MonthlyPoint[]> {
    const since = last12Months();

    const rows = await this.prisma.$queryRaw<MonthlyRevenueRow[]>(Prisma.sql`
      SELECT date_trunc('month', "createdAt") AS period, SUM("amountMinor")::bigint AS "totalMinor"
      FROM "payment_transactions"
      WHERE "status" = ${PaymentTransactionStatus.SUCCEEDED}::"PaymentTransactionStatus"
        AND "createdAt" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({
      period: monthKey(row.period),
      count: Number(row.totalMinor ?? 0),
    }));
  }

  async subscriptionsByStatus() {
    const rows = await this.prisma.subscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return this.fillEnumCounts(
      SubscriptionStatus,
      rows,
      (row) => row.status,
      (row) => row._count._all,
    );
  }

  async paymentsByStatus() {
    const rows = await this.prisma.paymentTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return this.fillEnumCounts(
      PaymentTransactionStatus,
      rows,
      (row) => row.status,
      (row) => row._count._all,
    );
  }

  async erpIntegrations() {
    const [byProvider, byConnectionStatus] = await Promise.all([
      this.prisma.financialIntegration.groupBy({ by: ["provider"], _count: { _all: true } }),
      this.prisma.eRPConnection.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return {
      byProviderType: this.fillEnumCounts(
        FinancialProviderType,
        byProvider,
        (row) => row.provider,
        (row) => row._count._all,
      ),
      byConnectionStatus: this.fillEnumCounts(
        ERPConnectionStatus,
        byConnectionStatus,
        (row) => row.status,
        (row) => row._count._all,
      ),
    };
  }

  /** `AccessLog` count grouped by day, last 30 days - mirrors `analytics.service.ts`'s `apiRequests`. */
  async apiUsage(): Promise<DailyPoint[]> {
    const since = last30Days();

    const rows = await this.prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS period, COUNT(*)::int AS count
      FROM "access_logs"
      WHERE "createdAt" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({ period: dayKey(row.period), count: Number(row.count) }));
  }

  /** `Customer` count grouped by month, last 12 months. */
  async customerGrowth(): Promise<MonthlyPoint[]> {
    const since = last12Months();

    const rows = await this.prisma.$queryRaw<MonthlyCountRow[]>(Prisma.sql`
      SELECT date_trunc('month', "createdAt") AS period, COUNT(*)::int AS count
      FROM "customers"
      WHERE "createdAt" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({ period: monthKey(row.period), count: Number(row.count) }));
  }

  /**
   * "Developer growth" - this schema has no `UserType`/`isDeveloper` flag,
   * so a User counts as a platform "developer" here iff they hold at
   * least one `ApplicationMember` or `OrganizationMember` row (i.e. they
   * belong to some org/app team), as opposed to a pure end-customer who
   * only ever appears via `Customer.userId`. Grouped by the user's own
   * `createdAt`, last 12 months. This is a reasonable proxy, not a
   * guaranteed-precise definition - documented here deliberately.
   */
  async developerGrowth(): Promise<MonthlyPoint[]> {
    const since = last12Months();

    const rows = await this.prisma.$queryRaw<MonthlyCountRow[]>(Prisma.sql`
      SELECT date_trunc('month', u."createdAt") AS period, COUNT(DISTINCT u.id)::int AS count
      FROM "users" u
      WHERE u."createdAt" >= ${since}
        AND (
          EXISTS (SELECT 1 FROM "application_members" am WHERE am."userId" = u.id)
          OR EXISTS (SELECT 1 FROM "organization_members" om WHERE om."userId" = u.id)
        )
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({ period: monthKey(row.period), count: Number(row.count) }));
  }

  /** No file-storage system exists anywhere in this platform - honest "not tracked" rather than a fabricated number. */
  storageUsage() {
    return { notTracked: true };
  }

  private fillEnumCounts<E extends Record<string, string>, Row>(
    enumObj: E,
    rows: Row[],
    getKey: (row: Row) => string,
    getCount: (row: Row) => number,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const value of Object.values(enumObj)) {
      result[value] = 0;
    }
    for (const row of rows) {
      result[getKey(row)] = getCount(row);
    }
    return result;
  }
}
