import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateEntitlementDefinitionDto } from "./dto/create-entitlement-definition.dto";

@Injectable()
export class EntitlementDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateEntitlementDefinitionDto,
    meta: RequestMeta,
  ) {
    const definition = await this.prisma.entitlementDefinition.create({
      data: {
        applicationId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        featureId: dto.featureId,
      },
    });

    await this.auditService.record({
      action: "ENTITLEMENT_DEFINITION_CREATED",
      userId,
      applicationId,
      metadata: { entitlementDefinitionId: definition.id },
      ...meta,
    });

    return definition;
  }

  async list(applicationId: string) {
    return this.prisma.entitlementDefinition.findMany({
      where: { applicationId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }
}
