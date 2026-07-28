import { PaymentTransactionStatus, ReportType, type Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/** Optional filters a report request may carry in its `filters` JSON column. */
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
}

function parseFilters(filters: Prisma.JsonValue | null | undefined): ReportFilters {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {};
  }
  return filters as ReportFilters;
}

function dateRangeWhere(filters: ReportFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.startDate && !filters.endDate) {
    return undefined;
  }
  return {
    ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
    ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
  };
}

/**
 * Runs the single reasonably-scoped query/aggregation for a given
 * `ReportType` and normalizes the result into flat rows suitable for every
 * output format (CSV/EXCEL/PDF render tabular rows directly; JSON just
 * stringifies the same array).
 */
export async function runReportQuery(
  prisma: PrismaService,
  type: ReportType,
  organizationId: string | null,
  rawFilters: Prisma.JsonValue | null,
): Promise<Record<string, unknown>[]> {
  const filters = parseFilters(rawFilters);
  const createdAtRange = dateRangeWhere(filters);

  switch (type) {
    case ReportType.REVENUE: {
      const transactions = await prisma.paymentTransaction.findMany({
        where: {
          status: PaymentTransactionStatus.SUCCEEDED,
          createdAt: createdAtRange,
          customer: organizationId ? { organizationId } : undefined,
        },
        select: { amountMinor: true, currency: true, createdAt: true },
      });

      const byDay = new Map<string, { count: number; totalMinor: number; currency: string }>();
      for (const tx of transactions) {
        const day = tx.createdAt.toISOString().slice(0, 10);
        const entry = byDay.get(day) ?? { count: 0, totalMinor: 0, currency: tx.currency };
        entry.count += 1;
        entry.totalMinor += tx.amountMinor;
        byDay.set(day, entry);
      }

      return Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({
          period,
          transactionCount: v.count,
          totalAmountMinor: v.totalMinor,
          currency: v.currency,
        }));
    }

    case ReportType.SUBSCRIPTIONS: {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          organizationId: organizationId ?? undefined,
          createdAt: createdAtRange,
        },
        include: {
          customer: { select: { displayName: true, email: true } },
          plan: { select: { name: true } },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        planName: s.plan?.name,
        productName: s.product?.name,
        customerName: s.customer?.displayName,
        customerEmail: s.customer?.email,
        quantity: s.quantity,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        createdAt: s.createdAt,
      }));
    }

    case ReportType.CUSTOMERS: {
      const customers = await prisma.customer.findMany({
        where: {
          organizationId: organizationId ?? undefined,
          createdAt: createdAtRange,
        },
        include: { _count: { select: { subscriptions: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return customers.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        email: c.email,
        type: c.type,
        status: c.status,
        subscriptionCount: c._count.subscriptions,
        createdAt: c.createdAt,
      }));
    }

    case ReportType.APPLICATIONS: {
      const applications = await prisma.application.findMany({
        where: {
          organizationId: organizationId ?? undefined,
          createdAt: createdAtRange,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return applications.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        status: a.status,
        visibility: a.visibility,
        organizationId: a.organizationId,
        createdAt: a.createdAt,
      }));
    }

    case ReportType.MARKETPLACE: {
      // Listing/Review are owned by the parallel marketplace/reviews slices
      // of this phase - queried directly via PrismaService rather than
      // importing their (possibly not-yet-existing) services.
      const listings = await prisma.listing.findMany({
        where: organizationId ? { application: { organizationId } } : undefined,
        include: {
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return listings.map((listing) => {
        const reviewCount = listing.reviews.length;
        const avgRating =
          reviewCount > 0
            ? listing.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : null;
        return {
          listingId: listing.id,
          applicationId: listing.applicationId,
          status: listing.status,
          visibility: listing.visibility,
          installCount: listing.installCount,
          reviewCount,
          averageRating: avgRating,
        };
      });
    }

    case ReportType.FINANCIAL_SYNC: {
      const groups = await prisma.financialSync.groupBy({
        by: ["status"],
        where: organizationId ? { financialEvent: { organizationId } } : undefined,
        _count: true,
      });

      return groups.map((g) => ({ status: g.status, count: g._count }));
    }

    case ReportType.DEVELOPER_ACTIVITY: {
      const logs = await prisma.auditLog.findMany({
        where: {
          organizationId: organizationId ?? undefined,
          createdAt: createdAtRange,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        userId: log.userId,
        organizationId: log.organizationId,
        applicationId: log.applicationId,
        createdAt: log.createdAt,
      }));
    }

    case ReportType.API_USAGE: {
      const apiKeys = await prisma.aPIKey.findMany({
        where: organizationId ? { apiClient: { organizationId } } : undefined,
        include: { apiClient: { select: { id: true, name: true, organizationId: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        apiClientId: key.apiClientId,
        apiClientName: key.apiClient?.name,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      }));
    }

    case ReportType.LICENSE_USAGE: {
      const licenses = await prisma.license.findMany({
        where: { organizationId: organizationId ?? undefined },
        include: { _count: { select: { seats: true, deviceRegistrations: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      return licenses.map((license) => ({
        id: license.id,
        applicationId: license.applicationId,
        type: license.type,
        status: license.status,
        seatLimit: license.seatLimit,
        seatCount: license._count.seats,
        deviceLimit: license.deviceLimit,
        deviceCount: license._count.deviceRegistrations,
        issuedAt: license.issuedAt,
        expiresAt: license.expiresAt,
      }));
    }

    case ReportType.STORAGE: {
      // This platform has no object-storage backend integrated yet (see
      // `system-health/providers/storage-health.provider.ts`'s doc comment
      // for the established precedent) - report a documented placeholder
      // rather than fabricating fake storage data.
      return [
        {
          note: "No object storage backend is integrated yet - nothing to report.",
        },
      ];
    }

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported report type: ${String(exhaustiveCheck)}`);
    }
  }
}
