import { Injectable, NotFoundException } from "@nestjs/common";
import { UsageResetPolicy } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RuntimeAuthorizationService } from "../entitlements/runtime-authorization.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpsertUsageLimitDto } from "./dto/upsert-usage-limit.dto";

/**
 * Admin-facing CRUD around UsageLimit/UsageCounter. The actual enforcement
 * logic (lazy scheduled-reset-on-read, increment/decrement) already lives in
 * RuntimeAuthorizationService - this service only manages the ceiling
 * configuration and gives admins visibility/override on the running
 * counters, it never duplicates the enforcement path.
 */
@Injectable()
export class UsageLimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly runtimeAuth: RuntimeAuthorizationService,
  ) {}

  async upsertLimit(
    organizationId: string,
    applicationId: string,
    key: string,
    dto: UpsertUsageLimitDto,
    userId: string,
    meta: RequestMeta,
  ) {
    const definition = await this.getDefinitionOrThrow(applicationId, key);

    const limit = await this.prisma.usageLimit.upsert({
      where: {
        organizationId_applicationId_entitlementDefinitionId: {
          organizationId,
          applicationId,
          entitlementDefinitionId: definition.id,
        },
      },
      create: {
        organizationId,
        applicationId,
        entitlementDefinitionId: definition.id,
        limitValue: dto.limitValue ?? null,
        isUnlimited: dto.isUnlimited ?? false,
        resetPolicy: dto.resetPolicy ?? UsageResetPolicy.NEVER,
      },
      update: {
        limitValue: dto.limitValue,
        isUnlimited: dto.isUnlimited,
        resetPolicy: dto.resetPolicy,
      },
    });

    await this.auditService.record({
      action: "USAGE_LIMIT_UPDATED",
      userId,
      organizationId,
      applicationId,
      metadata: {
        key,
        limitValue: limit.limitValue,
        isUnlimited: limit.isUnlimited,
        resetPolicy: limit.resetPolicy,
      },
      ...meta,
    });

    return limit;
  }

  /** All configured limits for the application, each paired with its current counter (if any). */
  async list(organizationId: string, applicationId: string) {
    const [limits, counters] = await Promise.all([
      this.prisma.usageLimit.findMany({
        where: { organizationId, applicationId },
        include: { entitlementDefinition: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.usageCounter.findMany({ where: { organizationId, applicationId } }),
    ]);

    const counterByDefinitionId = new Map(counters.map((c) => [c.entitlementDefinitionId, c]));

    return limits.map((limit) => ({
      ...limit,
      counter: counterByDefinitionId.get(limit.entitlementDefinitionId) ?? null,
    }));
  }

  async getOne(organizationId: string, applicationId: string, key: string) {
    const definition = await this.getDefinitionOrThrow(applicationId, key);

    const [limit, usage] = await Promise.all([
      this.prisma.usageLimit.findUnique({
        where: {
          organizationId_applicationId_entitlementDefinitionId: {
            organizationId,
            applicationId,
            entitlementDefinitionId: definition.id,
          },
        },
      }),
      this.runtimeAuth.getUsage(organizationId, applicationId, key),
    ]);

    return { key, entitlementDefinitionId: definition.id, limit, usage };
  }

  /** Force-resets the running counter early (e.g. support/goodwill), independent of its reset policy. */
  async resetCounter(
    organizationId: string,
    applicationId: string,
    key: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const definition = await this.getDefinitionOrThrow(applicationId, key);
    const now = new Date();

    const counter = await this.prisma.usageCounter.upsert({
      where: {
        organizationId_applicationId_entitlementDefinitionId: {
          organizationId,
          applicationId,
          entitlementDefinitionId: definition.id,
        },
      },
      create: {
        organizationId,
        applicationId,
        entitlementDefinitionId: definition.id,
        value: 0,
        periodStart: now,
        lastResetAt: now,
      },
      update: { value: 0, periodStart: now, lastResetAt: now },
    });

    await this.auditService.record({
      action: "USAGE_LIMIT_UPDATED",
      userId,
      organizationId,
      applicationId,
      metadata: { key, action: "counter_reset" },
      ...meta,
    });

    return counter;
  }

  private async getDefinitionOrThrow(applicationId: string, key: string) {
    const definition = await this.prisma.entitlementDefinition.findUnique({
      where: { applicationId_key: { applicationId, key } },
    });
    if (!definition) {
      throw new NotFoundException(`Entitlement definition '${key}' not found for this application`);
    }
    return definition;
  }
}
