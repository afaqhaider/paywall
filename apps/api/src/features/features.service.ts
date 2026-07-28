import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateFeatureDto } from "./dto/create-feature.dto";
import type { UpdateFeatureDto } from "./dto/update-feature.dto";

@Injectable()
export class FeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(applicationId: string, userId: string, dto: CreateFeatureDto, meta: RequestMeta) {
    const feature = await this.prisma.feature.create({
      data: {
        applicationId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        unit: dto.unit,
      },
    });

    await this.auditService.record({
      action: "FEATURE_CREATED",
      userId,
      applicationId,
      metadata: { featureId: feature.id },
      ...meta,
    });

    return feature;
  }

  async list(applicationId: string) {
    return this.prisma.feature.findMany({
      where: { applicationId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  async getOne(featureId: string) {
    const feature = await this.prisma.feature.findUnique({ where: { id: featureId } });
    if (!feature) {
      throw new NotFoundException("Feature not found");
    }
    return feature;
  }

  async update(featureId: string, userId: string, dto: UpdateFeatureDto, meta: RequestMeta) {
    const feature = await this.prisma.feature.update({
      where: { id: featureId },
      data: { ...dto },
    });

    await this.auditService.record({
      action: "FEATURE_UPDATED",
      userId,
      applicationId: feature.applicationId,
      metadata: { featureId },
      ...meta,
    });

    return feature;
  }

  async archive(featureId: string, userId: string, meta: RequestMeta) {
    const feature = await this.prisma.feature.update({
      where: { id: featureId },
      data: { archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "FEATURE_ARCHIVED",
      userId,
      applicationId: feature.applicationId,
      metadata: { featureId },
      ...meta,
    });

    return feature;
  }
}
