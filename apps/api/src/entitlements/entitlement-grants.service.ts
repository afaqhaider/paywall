import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntitlementGrantSource, EntitlementGrantStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { EntitlementResolverService } from "./entitlement-resolver.service";
import type { CreateEntitlementGrantDto } from "./dto/create-entitlement-grant.dto";

@Injectable()
export class EntitlementGrantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly resolver: EntitlementResolverService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateEntitlementGrantDto,
    meta: RequestMeta,
  ) {
    const definition = await this.prisma.entitlementDefinition.findUnique({
      where: { id: dto.entitlementDefinitionId },
    });
    if (!definition || definition.applicationId !== dto.applicationId) {
      throw new NotFoundException("Entitlement definition not found for this application");
    }

    const grant = await this.prisma.entitlementGrant.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        entitlementDefinitionId: dto.entitlementDefinitionId,
        source: dto.source ?? EntitlementGrantSource.MANUAL,
        boolValue: dto.boolValue,
        numberValue: dto.numberValue,
        textValue: dto.textValue,
        isUnlimited: dto.isUnlimited ?? false,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        metadata: dto.metadata,
      },
    });

    await this.prisma.entitlementGrantEvent.create({
      data: { grantId: grant.id, type: "created", createdById: userId },
    });

    await this.resolver.recompute(organizationId, dto.applicationId, dto.entitlementDefinitionId);

    await this.auditService.record({
      action: "ENTITLEMENT_GRANT_CREATED",
      userId,
      organizationId,
      applicationId: dto.applicationId,
      ...meta,
    });

    return grant;
  }

  async revoke(grantId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const grant = await this.prisma.entitlementGrant.findUnique({ where: { id: grantId } });
    if (!grant || grant.organizationId !== organizationId) {
      throw new NotFoundException("Entitlement grant not found");
    }
    if (grant.status !== EntitlementGrantStatus.ACTIVE) {
      throw new BadRequestException("Grant is not active");
    }

    await this.prisma.entitlementGrant.update({
      where: { id: grantId },
      data: { status: EntitlementGrantStatus.REVOKED, revokedAt: new Date() },
    });

    await this.prisma.entitlementGrantEvent.create({
      data: { grantId, type: "revoked", createdById: userId },
    });

    await this.resolver.recompute(
      organizationId,
      grant.applicationId,
      grant.entitlementDefinitionId,
    );

    await this.auditService.record({
      action: "ENTITLEMENT_GRANT_REVOKED",
      userId,
      organizationId,
      applicationId: grant.applicationId,
      ...meta,
    });
  }

  async list(organizationId: string, applicationId?: string) {
    return this.prisma.entitlementGrant.findMany({
      where: { organizationId, applicationId },
      include: { entitlementDefinition: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /**
   * Materializes EntitlementGrants (and their FeatureAccess cache rows) from
   * a Subscription's current plan - the one-way read from the Subscription
   * Engine into this engine. Deterministic idempotency keys make this safe
   * to call repeatedly (on every subscription mutation, or on a schedule);
   * it never mutates the Subscription itself.
   */
  async syncFromSubscription(subscriptionId: string, userId: string, meta: RequestMeta) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            planFeatures: { include: { feature: { include: { entitlementDefinitions: true } } } },
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    const isEntitled = ["ACTIVE", "TRIALING", "GRACE_PERIOD"].includes(subscription.status);
    const touched: string[] = [];

    for (const planFeature of subscription.plan.planFeatures) {
      for (const definition of planFeature.feature.entitlementDefinitions) {
        const idempotencyKey = `sub:${subscriptionId}:def:${definition.id}`;

        const existing = await this.prisma.entitlementGrant.findUnique({
          where: { idempotencyKey },
        });

        if (!isEntitled) {
          if (existing && existing.status === EntitlementGrantStatus.ACTIVE) {
            await this.prisma.entitlementGrant.update({
              where: { id: existing.id },
              data: { status: EntitlementGrantStatus.REVOKED, revokedAt: new Date() },
            });
            await this.prisma.entitlementGrantEvent.create({
              data: {
                grantId: existing.id,
                type: "subscription_no_longer_entitles",
                createdById: userId,
              },
            });
          }
        } else if (existing) {
          await this.prisma.entitlementGrant.update({
            where: { id: existing.id },
            data: {
              status: EntitlementGrantStatus.ACTIVE,
              boolValue: planFeature.boolValue,
              numberValue: planFeature.numberValue,
              textValue: planFeature.textValue,
              revokedAt: null,
              version: { increment: 1 },
            },
          });
        } else {
          const grant = await this.prisma.entitlementGrant.create({
            data: {
              organizationId: subscription.organizationId,
              applicationId: subscription.applicationId,
              entitlementDefinitionId: definition.id,
              subscriptionId,
              source: EntitlementGrantSource.SUBSCRIPTION,
              boolValue: planFeature.boolValue,
              numberValue: planFeature.numberValue,
              textValue: planFeature.textValue,
              idempotencyKey,
            },
          });
          await this.prisma.entitlementGrantEvent.create({
            data: { grantId: grant.id, type: "created_from_subscription", createdById: userId },
          });
        }

        await this.resolver.recompute(
          subscription.organizationId,
          subscription.applicationId,
          definition.id,
        );
        touched.push(definition.id);
      }
    }

    await this.auditService.record({
      action: "ENTITLEMENT_GRANT_CREATED",
      userId,
      organizationId: subscription.organizationId,
      applicationId: subscription.applicationId,
      metadata: { subscriptionId, entitlementDefinitionsSynced: touched },
      ...meta,
    });

    return { synced: touched.length };
  }
}
