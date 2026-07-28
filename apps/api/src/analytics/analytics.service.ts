import { Injectable } from "@nestjs/common";
import { Prisma, WebhookDeliveryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AnalyticsRange } from "./dto/analytics-range-query.dto";

interface ApiRequestPeriodRow {
  period: Date;
  count: bigint | number;
}

interface AuthRequestPeriodRow {
  period: Date;
  allowed: bigint | number;
  denied: bigint | number;
}

export interface ApiRequestPoint {
  period: string;
  count: number;
}

export interface AuthRequestPoint {
  period: string;
  allowed: number;
  denied: number;
}

export interface WebhookStats {
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  successRatePercent: number;
}

export interface BusinessMetrics {
  subscriptionCount: number;
  activeSubscriptionCount: number;
  activeCustomerCount: number;
  activeLicenseCount: number;
}

/**
 * Developer-facing, read-only metrics. Nothing here writes anything -
 * every route just aggregates existing rows (AccessLog, WebhookDelivery,
 * Subscription, Customer, License) scoped to a single application.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatPeriod(period: Date, range: AnalyticsRange): string {
    const iso = period.toISOString();
    // "daily" -> "2026-07-28", "monthly" -> "2026-07"
    return range === "monthly" ? iso.slice(0, 7) : iso.slice(0, 10);
  }

  private since(range: AnalyticsRange): Date {
    const now = new Date();
    if (range === "monthly") {
      const start = new Date(now);
      start.setUTCMonth(start.getUTCMonth() - 12);
      return start;
    }
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    return start;
  }

  async apiRequests(
    applicationId: string,
    rangeInput?: AnalyticsRange,
  ): Promise<ApiRequestPoint[]> {
    const range: AnalyticsRange = rangeInput ?? "daily";
    const trunc = range === "monthly" ? "month" : "day";
    const since = this.since(range);

    const rows = await this.prisma.$queryRaw<ApiRequestPeriodRow[]>(Prisma.sql`
      SELECT date_trunc(${trunc}, "createdAt") AS period, COUNT(*)::int AS count
      FROM "access_logs"
      WHERE "applicationId" = ${applicationId}
        AND "apiKeyId" IS NOT NULL
        AND "createdAt" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({
      period: this.formatPeriod(row.period, range),
      count: Number(row.count),
    }));
  }

  async authRequests(
    applicationId: string,
    rangeInput?: AnalyticsRange,
  ): Promise<AuthRequestPoint[]> {
    const range: AnalyticsRange = rangeInput ?? "daily";
    const trunc = range === "monthly" ? "month" : "day";
    const since = this.since(range);

    const rows = await this.prisma.$queryRaw<AuthRequestPeriodRow[]>(Prisma.sql`
      SELECT
        date_trunc(${trunc}, "createdAt") AS period,
        COUNT(*) FILTER (WHERE "allowed")::int AS allowed,
        COUNT(*) FILTER (WHERE NOT "allowed")::int AS denied
      FROM "access_logs"
      WHERE "applicationId" = ${applicationId}
        AND "createdAt" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((row) => ({
      period: this.formatPeriod(row.period, range),
      allowed: Number(row.allowed),
      denied: Number(row.denied),
    }));
  }

  async webhookStats(applicationId: string): Promise<WebhookStats> {
    const [successCount, failureCount, totalDeliveries] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { applicationId }, status: WebhookDeliveryStatus.SUCCESS },
      }),
      this.prisma.webhookDelivery.count({
        where: {
          webhookEndpoint: { applicationId },
          status: {
            in: [WebhookDeliveryStatus.FAILED, WebhookDeliveryStatus.EXHAUSTED],
          },
        },
      }),
      this.prisma.webhookDelivery.count({
        where: {
          webhookEndpoint: { applicationId },
          status: {
            in: [
              WebhookDeliveryStatus.SUCCESS,
              WebhookDeliveryStatus.FAILED,
              WebhookDeliveryStatus.EXHAUSTED,
            ],
          },
        },
      }),
    ]);

    const successRatePercent = totalDeliveries > 0 ? (successCount / totalDeliveries) * 100 : 0;

    return {
      totalDeliveries,
      successCount,
      failureCount,
      successRatePercent: Math.round(successRatePercent * 100) / 100,
    };
  }

  async businessMetrics(applicationId: string): Promise<BusinessMetrics> {
    // "Active customers" has no dedicated status field on Customer in this
    // schema, so this uses total Customer rows scoped to the application as
    // the proxy for "active customers" - documented here per the phase spec.
    const [subscriptionCount, activeSubscriptionCount, activeCustomerCount, activeLicenseCount] =
      await Promise.all([
        this.prisma.subscription.count({ where: { applicationId } }),
        this.prisma.subscription.count({ where: { applicationId, status: "ACTIVE" } }),
        this.prisma.customer.count({ where: { applicationId } }),
        this.prisma.license.count({ where: { applicationId, status: "ACTIVE" } }),
      ]);

    return { subscriptionCount, activeSubscriptionCount, activeCustomerCount, activeLicenseCount };
  }
}
