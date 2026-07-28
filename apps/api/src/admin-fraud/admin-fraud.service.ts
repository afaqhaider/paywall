import { Injectable } from "@nestjs/common";
import {
  DeviceStatus,
  PaymentTransactionStatus,
  Prisma,
  WebhookDeliveryStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";

// ---------------------------------------------------------------------------
// Every threshold used by this module, named and documented in one place so
// they're easy to find and tune later. Detection is pure aggregation over
// existing tables - no new models, no ML, just "reasonable" numbers.
// ---------------------------------------------------------------------------

/** >= this many FAILED PaymentTransactions for the same customer within
 * `FAILED_PAYMENT_WINDOW_DAYS` looks like a compromised/expired payment
 * method being retried, or card testing. */
const FAILED_PAYMENT_THRESHOLD = 3;
const FAILED_PAYMENT_WINDOW_DAYS = 7;

/** >= this many LOGIN_FAILED audit rows for the same user within one hour
 * looks like a credential-stuffing/brute-force attempt. */
const LOGIN_FAILURE_THRESHOLD = 5;
const LOGIN_FAILURE_WINDOW_HOURS = 1;

/** >= this many *distinct* source IPs producing a successful login for the
 * same user within 24h looks like a shared/leaked credential rather than one
 * person moving around. */
const DISTINCT_IP_THRESHOLD = 3;
const DISTINCT_IP_WINDOW_HOURS = 24;

/** >= this many `allowed=false` AccessLog rows for the same API key within
 * 24h looks like a key being used past its entitlements/rate limit on
 * purpose, not the occasional expected denial. */
const API_ABUSE_DENIED_THRESHOLD = 20;
const API_ABUSE_WINDOW_HOURS = 24;

/** >= this many EXHAUSTED WebhookDelivery rows for the same endpoint within
 * 7 days means the receiving URL has been unreachable/erroring long enough
 * that it's worth flagging instead of quietly retrying forever. */
const WEBHOOK_ABUSE_EXHAUSTED_THRESHOLD = 10;
const WEBHOOK_ABUSE_WINDOW_DAYS = 7;

/** >= this many Trial rows total (no time window - one trial per
 * (customer, product) is already DB-enforced, so this only fires once a
 * customer has churned through several different products/plans) suggests
 * trial-hopping rather than genuine evaluation. */
const EXCESSIVE_TRIALS_THRESHOLD = 3;

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

interface DistinctIpRow {
  userId: string;
  distinctIps: bigint | number;
}

@Injectable()
export class AdminFraudService {
  constructor(private readonly prisma: PrismaService) {}

  async failedPayments() {
    const since = daysAgo(FAILED_PAYMENT_WINDOW_DAYS);

    const grouped = await this.prisma.paymentTransaction.groupBy({
      by: ["customerId"],
      where: { status: PaymentTransactionStatus.FAILED, createdAt: { gte: since } },
      _count: { customerId: true },
      having: { customerId: { _count: { gte: FAILED_PAYMENT_THRESHOLD } } },
      orderBy: { _count: { customerId: "desc" } },
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, organizationId: true, displayName: true, email: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return {
      thresholds: { count: FAILED_PAYMENT_THRESHOLD, windowDays: FAILED_PAYMENT_WINDOW_DAYS },
      results: grouped.map((g) => ({
        customer: byId.get(g.customerId) ?? { id: g.customerId },
        failedPaymentCount: g._count.customerId,
      })),
    };
  }

  async suspiciousLogins() {
    const failureSince = hoursAgo(LOGIN_FAILURE_WINDOW_HOURS);
    const distinctIpSince = hoursAgo(DISTINCT_IP_WINDOW_HOURS);

    const [repeatedFailures, distinctIpRows] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ["userId"],
        where: { action: "LOGIN_FAILED", createdAt: { gte: failureSince }, userId: { not: null } },
        _count: { userId: true },
        having: { userId: { _count: { gte: LOGIN_FAILURE_THRESHOLD } } },
        orderBy: { _count: { userId: "desc" } },
      }),
      // `COUNT(DISTINCT ipAddress)` per user has no groupBy/having
      // equivalent in Prisma Client (having only aggregates fields already
      // being summarized, not a distinct count) - raw SQL, the same
      // `$queryRaw` escape hatch `AnalyticsService` already uses.
      this.prisma.$queryRaw<DistinctIpRow[]>(Prisma.sql`
        SELECT "userId", COUNT(DISTINCT "ipAddress")::int AS "distinctIps"
        FROM "audit_logs"
        WHERE "action" = 'LOGIN_SUCCEEDED'
          AND "createdAt" >= ${distinctIpSince}
          AND "userId" IS NOT NULL
          AND "ipAddress" IS NOT NULL
        GROUP BY "userId"
        HAVING COUNT(DISTINCT "ipAddress") >= ${DISTINCT_IP_THRESHOLD}
        ORDER BY "distinctIps" DESC
      `),
    ]);

    const userIds = [
      ...new Set([
        ...repeatedFailures.map((r) => r.userId).filter((id): id is string => id !== null),
        ...distinctIpRows.map((r) => r.userId),
      ]),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      thresholds: {
        repeatedFailures: {
          count: LOGIN_FAILURE_THRESHOLD,
          windowHours: LOGIN_FAILURE_WINDOW_HOURS,
        },
        distinctIps: { count: DISTINCT_IP_THRESHOLD, windowHours: DISTINCT_IP_WINDOW_HOURS },
      },
      repeatedFailures: repeatedFailures.map((r) => ({
        user: (r.userId && byId.get(r.userId)) ?? { id: r.userId },
        failedLoginCount: r._count.userId,
      })),
      distinctIpLogins: distinctIpRows.map((r) => ({
        user: byId.get(r.userId) ?? { id: r.userId },
        distinctIpCount: Number(r.distinctIps),
      })),
    };
  }

  async deviceAbuse() {
    const licenses = await this.prisma.license.findMany({
      where: { deviceLimit: { not: null } },
      select: { id: true, organizationId: true, applicationId: true, deviceLimit: true },
    });
    if (licenses.length === 0) {
      return {
        thresholds: { note: "flags any License where active device count > deviceLimit" },
        results: [],
      };
    }

    const counts = await this.prisma.deviceRegistration.groupBy({
      by: ["licenseId"],
      where: { licenseId: { in: licenses.map((l) => l.id) }, status: DeviceStatus.ACTIVE },
      _count: { _all: true },
    });
    const countByLicense = new Map(counts.map((c) => [c.licenseId, c._count._all]));

    const results = licenses
      .map((license) => ({
        license,
        activeDeviceCount: countByLicense.get(license.id) ?? 0,
      }))
      .filter((row) => isOverDeviceLimit(row.activeDeviceCount, row.license.deviceLimit));

    return {
      thresholds: { note: "flags any License where active device count > deviceLimit" },
      results,
    };
  }

  async apiAbuse() {
    const since = hoursAgo(API_ABUSE_WINDOW_HOURS);

    const grouped = await this.prisma.accessLog.groupBy({
      by: ["apiKeyId"],
      where: { allowed: false, createdAt: { gte: since }, apiKeyId: { not: null } },
      _count: { apiKeyId: true },
      having: { apiKeyId: { _count: { gte: API_ABUSE_DENIED_THRESHOLD } } },
      orderBy: { _count: { apiKeyId: "desc" } },
    });

    const apiKeys = await this.prisma.aPIKey.findMany({
      where: {
        id: { in: grouped.map((g) => g.apiKeyId).filter((id): id is string => id !== null) },
      },
      select: { id: true, name: true, apiClientId: true },
    });
    const byId = new Map(apiKeys.map((k) => [k.id, k]));

    return {
      thresholds: { deniedCount: API_ABUSE_DENIED_THRESHOLD, windowHours: API_ABUSE_WINDOW_HOURS },
      results: grouped.map((g) => ({
        apiKey: (g.apiKeyId && byId.get(g.apiKeyId)) ?? { id: g.apiKeyId },
        deniedCount: g._count.apiKeyId,
      })),
    };
  }

  async webhookAbuse() {
    const since = daysAgo(WEBHOOK_ABUSE_WINDOW_DAYS);

    const grouped = await this.prisma.webhookDelivery.groupBy({
      by: ["webhookEndpointId"],
      where: { status: WebhookDeliveryStatus.EXHAUSTED, updatedAt: { gte: since } },
      _count: { webhookEndpointId: true },
      having: { webhookEndpointId: { _count: { gte: WEBHOOK_ABUSE_EXHAUSTED_THRESHOLD } } },
      orderBy: { _count: { webhookEndpointId: "desc" } },
    });

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { id: { in: grouped.map((g) => g.webhookEndpointId) } },
      select: { id: true, url: true, applicationId: true, status: true },
    });
    const byId = new Map(endpoints.map((e) => [e.id, e]));

    return {
      thresholds: {
        exhaustedCount: WEBHOOK_ABUSE_EXHAUSTED_THRESHOLD,
        windowDays: WEBHOOK_ABUSE_WINDOW_DAYS,
      },
      results: grouped.map((g) => ({
        endpoint: byId.get(g.webhookEndpointId) ?? { id: g.webhookEndpointId },
        exhaustedCount: g._count.webhookEndpointId,
      })),
    };
  }

  async excessiveTrials() {
    const grouped = await this.prisma.trial.groupBy({
      by: ["customerId"],
      _count: { customerId: true },
      having: { customerId: { _count: { gte: EXCESSIVE_TRIALS_THRESHOLD } } },
      orderBy: { _count: { customerId: "desc" } },
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, organizationId: true, displayName: true, email: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return {
      thresholds: {
        count: EXCESSIVE_TRIALS_THRESHOLD,
        note: "no time window - lifetime trial count",
      },
      results: grouped.map((g) => ({
        customer: byId.get(g.customerId) ?? { id: g.customerId },
        trialCount: g._count.customerId,
      })),
    };
  }

  async chargebacks(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.paymentDispute.findMany({
      where: cursorWhere,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        transaction: {
          include: {
            customer: {
              select: { id: true, organizationId: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    return paginateResults(rows, limit);
  }
}

function isOverDeviceLimit(activeDeviceCount: number, deviceLimit: number | null): boolean {
  return deviceLimit !== null && activeDeviceCount > deviceLimit;
}
