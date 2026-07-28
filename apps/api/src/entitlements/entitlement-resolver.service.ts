import { Injectable } from "@nestjs/common";
import {
  EntitlementGrantSource,
  EntitlementGrantStatus,
  type EntitlementGrant,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** MANUAL/PROMOTIONAL admin overrides always win over subscription-derived grants. */
const SOURCE_PRIORITY: Record<EntitlementGrantSource, number> = {
  MANUAL: 3,
  PROMOTIONAL: 2,
  TRIAL: 1,
  SUBSCRIPTION: 0,
};

@Injectable()
export class EntitlementResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes the single FeatureAccess row for (organization, application,
   * entitlementDefinition) from whichever active EntitlementGrant currently
   * wins - this is the only place that decides precedence, so the runtime
   * read path (`RuntimeAuthorizationService.hasEntitlement`) never has to.
   */
  async recompute(
    organizationId: string,
    applicationId: string,
    entitlementDefinitionId: string,
  ): Promise<void> {
    const now = new Date();

    const candidates = await this.prisma.entitlementGrant.findMany({
      where: {
        organizationId,
        applicationId,
        entitlementDefinitionId,
        status: EntitlementGrantStatus.ACTIVE,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });

    const winner = this.pickWinner(candidates);

    if (!winner) {
      await this.prisma.featureAccess.deleteMany({
        where: { organizationId, applicationId, entitlementDefinitionId },
      });
      return;
    }

    const hasAccess =
      winner.isUnlimited || winner.boolValue === true || winner.numberValue !== null;

    await this.prisma.featureAccess.upsert({
      where: {
        organizationId_applicationId_entitlementDefinitionId: {
          organizationId,
          applicationId,
          entitlementDefinitionId,
        },
      },
      create: {
        organizationId,
        applicationId,
        entitlementDefinitionId,
        hasAccess,
        numberValue: winner.numberValue,
        textValue: winner.textValue,
        isUnlimited: winner.isUnlimited,
        sourceGrantId: winner.id,
      },
      update: {
        hasAccess,
        numberValue: winner.numberValue,
        textValue: winner.textValue,
        isUnlimited: winner.isUnlimited,
        sourceGrantId: winner.id,
        computedAt: now,
      },
    });
  }

  private pickWinner(grants: EntitlementGrant[]): EntitlementGrant | null {
    if (grants.length === 0) return null;

    return grants.reduce((best, current) => {
      const bestPriority = SOURCE_PRIORITY[best.source];
      const currentPriority = SOURCE_PRIORITY[current.source];
      if (currentPriority > bestPriority) return current;
      if (currentPriority < bestPriority) return best;
      return current.createdAt > best.createdAt ? current : best;
    });
  }
}
