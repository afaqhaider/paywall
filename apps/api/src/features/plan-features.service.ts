import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertPlanFeatureDto } from "./dto/upsert-plan-feature.dto";

@Injectable()
export class PlanFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(planId: string) {
    return this.prisma.planFeature.findMany({
      where: { planId },
      include: { feature: true },
    });
  }

  async upsert(planId: string, dto: UpsertPlanFeatureDto) {
    return this.prisma.planFeature.upsert({
      where: { planId_featureId: { planId, featureId: dto.featureId } },
      create: {
        planId,
        featureId: dto.featureId,
        boolValue: dto.boolValue,
        numberValue: dto.numberValue,
        textValue: dto.textValue,
      },
      update: {
        boolValue: dto.boolValue,
        numberValue: dto.numberValue,
        textValue: dto.textValue,
      },
    });
  }

  async remove(planId: string, featureId: string): Promise<void> {
    await this.prisma.planFeature.delete({
      where: { planId_featureId: { planId, featureId } },
    });
  }
}
