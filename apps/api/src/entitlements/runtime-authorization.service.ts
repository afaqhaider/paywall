import { ForbiddenException, Injectable } from "@nestjs/common";
import { LicenseStatus, SeatAssignmentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashOpaqueToken } from "../common/utils/token.util";

export interface EntitlementCheckResult {
  allowed: boolean;
  numberValue: number | null;
  textValue: string | null;
  isUnlimited: boolean;
}

export interface UsageSnapshot {
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

/**
 * The runtime SDK surface: what every SS Zentronics application actually
 * calls to answer "can I do this?" in milliseconds. Every method here is a
 * read (or a single small write) against denormalized fast-path tables -
 * never a walk through Subscription -> Plan -> PlanFeature.
 */
@Injectable()
export class RuntimeAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async hasEntitlement(
    organizationId: string,
    applicationId: string,
    key: string,
  ): Promise<EntitlementCheckResult> {
    const definition = await this.prisma.entitlementDefinition.findUnique({
      where: { applicationId_key: { applicationId, key } },
    });
    if (!definition) {
      return { allowed: false, numberValue: null, textValue: null, isUnlimited: false };
    }

    const access = await this.prisma.featureAccess.findUnique({
      where: {
        organizationId_applicationId_entitlementDefinitionId: {
          organizationId,
          applicationId,
          entitlementDefinitionId: definition.id,
        },
      },
    });

    if (!access) {
      return { allowed: false, numberValue: null, textValue: null, isUnlimited: false };
    }

    return {
      allowed: access.hasAccess,
      numberValue: access.numberValue,
      textValue: access.textValue,
      isUnlimited: access.isUnlimited,
    };
  }

  async getUsage(
    organizationId: string,
    applicationId: string,
    key: string,
  ): Promise<UsageSnapshot> {
    const definition = await this.prisma.entitlementDefinition.findUniqueOrThrow({
      where: { applicationId_key: { applicationId, key } },
    });

    const [limit, counter] = await Promise.all([
      this.prisma.usageLimit.findUnique({
        where: {
          organizationId_applicationId_entitlementDefinitionId: {
            organizationId,
            applicationId,
            entitlementDefinitionId: definition.id,
          },
        },
      }),
      this.getOrCreateCounter(organizationId, applicationId, definition.id),
    ]);

    const isUnlimited = limit?.isUnlimited ?? false;
    const limitValue = limit?.limitValue ?? null;

    return {
      used: counter.value,
      limit: limitValue,
      remaining:
        isUnlimited || limitValue === null ? null : Math.max(0, limitValue - counter.value),
      isUnlimited,
    };
  }

  async incrementUsage(
    organizationId: string,
    applicationId: string,
    key: string,
    amount = 1,
  ): Promise<UsageSnapshot> {
    const definition = await this.prisma.entitlementDefinition.findUniqueOrThrow({
      where: { applicationId_key: { applicationId, key } },
    });

    return this.prisma.$transaction(async (tx) => {
      const limit = await tx.usageLimit.findUnique({
        where: {
          organizationId_applicationId_entitlementDefinitionId: {
            organizationId,
            applicationId,
            entitlementDefinitionId: definition.id,
          },
        },
      });

      let counter = await tx.usageCounter.findUnique({
        where: {
          organizationId_applicationId_entitlementDefinitionId: {
            organizationId,
            applicationId,
            entitlementDefinitionId: definition.id,
          },
        },
      });

      counter ??= await tx.usageCounter.create({
        data: { organizationId, applicationId, entitlementDefinitionId: definition.id },
      });

      counter = this.applyScheduledReset(counter);

      const isUnlimited = limit?.isUnlimited ?? false;
      const limitValue = limit?.limitValue ?? null;
      const nextValue = counter.value + amount;

      if (!isUnlimited && limitValue !== null && nextValue > limitValue) {
        throw new ForbiddenException("Usage limit exceeded");
      }

      const updated = await tx.usageCounter.update({
        where: { id: counter.id },
        data: {
          value: nextValue,
          periodStart: counter.periodStart,
          lastResetAt: counter.lastResetAt,
        },
      });

      return {
        used: updated.value,
        limit: limitValue,
        remaining:
          isUnlimited || limitValue === null ? null : Math.max(0, limitValue - updated.value),
        isUnlimited,
      };
    });
  }

  async decrementUsage(
    organizationId: string,
    applicationId: string,
    key: string,
    amount = 1,
  ): Promise<UsageSnapshot> {
    const definition = await this.prisma.entitlementDefinition.findUniqueOrThrow({
      where: { applicationId_key: { applicationId, key } },
    });

    await this.prisma.usageCounter.updateMany({
      where: { organizationId, applicationId, entitlementDefinitionId: definition.id },
      data: { value: { decrement: amount } },
    });

    await this.prisma.usageCounter.updateMany({
      where: {
        organizationId,
        applicationId,
        entitlementDefinitionId: definition.id,
        value: { lt: 0 },
      },
      data: { value: 0 },
    });

    return this.getUsage(organizationId, applicationId, key);
  }

  async validateApiKey(rawKey: string) {
    const keyHash = hashOpaqueToken(rawKey);
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { keyHash },
      include: { apiClient: true, scopes: true },
    });

    if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
      return { valid: false as const };
    }

    await this.prisma.aPIKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

    return {
      valid: true as const,
      apiKeyId: apiKey.id,
      apiClientId: apiKey.apiClientId,
      organizationId: apiKey.apiClient.organizationId,
      applicationId: apiKey.apiClient.applicationId,
      scopes: apiKey.scopes.map((s) => s.scope),
    };
  }

  async validateLicenseKey(rawKey: string) {
    const keyHash = hashOpaqueToken(rawKey);
    const licenseKey = await this.prisma.licenseKey.findUnique({
      where: { keyHash },
      include: { license: true },
    });

    if (!licenseKey) {
      return { valid: false as const, reason: "not_found" as const };
    }
    if (licenseKey.status !== LicenseStatus.ACTIVE) {
      return { valid: false as const, reason: "inactive" as const };
    }
    if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      return { valid: false as const, reason: "expired" as const };
    }
    if (licenseKey.activationCount >= licenseKey.activationLimit) {
      return { valid: false as const, reason: "activation_limit_reached" as const };
    }

    return { valid: true as const, licenseId: licenseKey.licenseId, license: licenseKey.license };
  }

  async validateSeat(licenseId: string, userId: string): Promise<boolean> {
    const assignment = await this.prisma.seatAssignment.findFirst({
      where: {
        userId,
        status: SeatAssignmentStatus.ACTIVE,
        seat: { licenseId },
      },
    });

    return assignment !== null;
  }

  private async getOrCreateCounter(
    organizationId: string,
    applicationId: string,
    entitlementDefinitionId: string,
  ) {
    const existing = await this.prisma.usageCounter.findUnique({
      where: {
        organizationId_applicationId_entitlementDefinitionId: {
          organizationId,
          applicationId,
          entitlementDefinitionId,
        },
      },
    });
    if (existing) return this.applyScheduledReset(existing);

    return this.prisma.usageCounter.create({
      data: { organizationId, applicationId, entitlementDefinitionId },
    });
  }

  /** Resets are applied lazily on read/write rather than via a cron job. */
  private applyScheduledReset<
    T extends { periodEnd: Date | null; value: number; periodStart: Date },
  >(counter: T): T {
    if (counter.periodEnd && counter.periodEnd < new Date()) {
      return { ...counter, value: 0, periodStart: new Date() };
    }
    return counter;
  }
}
