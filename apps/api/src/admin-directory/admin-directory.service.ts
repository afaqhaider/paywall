import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type {
  AdminListQueryDto,
  AdminPaymentListQueryDto,
  AdminSubscriptionListQueryDto,
} from "./dto/admin-list-query.dto";

const orgSelect = { id: true, name: true, slug: true } as const;
const appSelect = { id: true, name: true, slug: true } as const;
const customerSelect = { id: true, displayName: true, email: true } as const;
const userSelect = { id: true, displayName: true, email: true } as const;

/**
 * Cross-cutting, global, read-only "admin directory" views. Every method
 * here is unscoped to a single organization (that's the point - this is
 * the platform-wide operator surface) and every list is cursor-paginated
 * per `cursor-pagination.util.ts`.
 */
@Injectable()
export class AdminDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async subscriptions(query: AdminSubscriptionListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.SubscriptionWhereInput = {
      AND: [
        cursorWhere,
        query.status ? { status: query.status } : undefined,
        query.search
          ? {
              OR: [
                { customer: { displayName: { contains: query.search, mode: "insensitive" } } },
                { customer: { email: { contains: query.search, mode: "insensitive" } } },
                { organization: { name: { contains: query.search, mode: "insensitive" } } },
                { application: { name: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.SubscriptionWhereInput[],
    };

    const rows = await this.prisma.subscription.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        customer: { select: customerSelect },
        organization: { select: orgSelect },
        application: { select: appSelect },
        plan: { select: { id: true, name: true, code: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async licenses(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.LicenseWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? {
              OR: [
                { organization: { name: { contains: query.search, mode: "insensitive" } } },
                { application: { name: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.LicenseWhereInput[],
    };

    const rows = await this.prisma.license.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        organization: { select: orgSelect },
        application: { select: appSelect },
        subscription: { select: { id: true, status: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async financialIntegrations(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.FinancialIntegrationWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? { organization: { name: { contains: query.search, mode: "insensitive" } } }
          : undefined,
      ].filter(Boolean) as Prisma.FinancialIntegrationWhereInput[],
    };

    const rows = await this.prisma.financialIntegration.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        organization: { select: orgSelect },
        // encryptedApiKey/iv/authTag deliberately excluded - never expose them here.
        erpConnection: {
          select: { id: true, status: true, lastSyncedAt: true, lastTestedAt: true },
        },
      },
    });

    return paginateResults(rows, limit);
  }

  async apiKeys(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.APIKeyWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                {
                  apiClient: {
                    organization: { name: { contains: query.search, mode: "insensitive" } },
                  },
                },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.APIKeyWhereInput[],
    };

    const rows = await this.prisma.aPIKey.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      // keyHash deliberately excluded - explicit select, never a raw row.
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastFour: true,
        rateLimitPerMin: true,
        expiresAt: true,
        revokedAt: true,
        rotatedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        apiClient: {
          select: {
            id: true,
            name: true,
            organization: { select: orgSelect },
            application: { select: appSelect },
          },
        },
      },
    });

    return paginateResults(rows, limit);
  }

  async webhooks(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.WebhookEndpointWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? {
              OR: [
                { url: { contains: query.search, mode: "insensitive" } },
                { application: { name: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.WebhookEndpointWhereInput[],
    };

    const rows = await this.prisma.webhookEndpoint.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      // WebhookSecret rows are a separate model and are never included here.
      select: {
        id: true,
        url: true,
        description: true,
        eventTypes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        application: { select: { ...appSelect, organization: { select: orgSelect } } },
      },
    });

    return paginateResults(rows, limit);
  }

  async devices(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.DeviceRegistrationWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? {
              OR: [
                { deviceId: { contains: query.search, mode: "insensitive" } },
                { name: { contains: query.search, mode: "insensitive" } },
                { user: { email: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.DeviceRegistrationWhereInput[],
    };

    const rows = await this.prisma.deviceRegistration.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        user: { select: userSelect },
        application: { select: appSelect },
      },
    });

    return paginateResults(rows, limit);
  }

  /**
   * `EntitlementGrant` (not the derived/cached `FeatureAccess`) is the
   * admin overview surface here: it carries `source`/`revokedReason`/
   * `validFrom`/`validUntil`, i.e. *why* an org has a feature, which is
   * more useful for an operator than `FeatureAccess`'s already-resolved
   * boolean snapshot.
   */
  async entitlements(query: AdminListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.EntitlementGrantWhereInput = {
      AND: [
        cursorWhere,
        query.search
          ? {
              OR: [
                { organization: { name: { contains: query.search, mode: "insensitive" } } },
                { application: { name: { contains: query.search, mode: "insensitive" } } },
                {
                  entitlementDefinition: {
                    key: { contains: query.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.EntitlementGrantWhereInput[],
    };

    const rows = await this.prisma.entitlementGrant.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        organization: { select: orgSelect },
        application: { select: appSelect },
        entitlementDefinition: { select: { id: true, key: true, name: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async payments(query: AdminPaymentListQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.PaymentTransactionWhereInput = {
      AND: [
        cursorWhere,
        query.status ? { status: query.status } : undefined,
        query.search
          ? {
              OR: [
                { customer: { displayName: { contains: query.search, mode: "insensitive" } } },
                { customer: { email: { contains: query.search, mode: "insensitive" } } },
                {
                  customer: {
                    organization: { name: { contains: query.search, mode: "insensitive" } },
                  },
                },
              ],
            }
          : undefined,
      ].filter(Boolean) as Prisma.PaymentTransactionWhereInput[],
    };

    const rows = await this.prisma.paymentTransaction.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        // PaymentTransaction has no direct organizationId - it hangs off
        // customer, so the organization comes along via customer.organization.
        customer: { select: { ...customerSelect, organization: { select: orgSelect } } },
      },
    });

    return paginateResults(rows, limit);
  }
}
