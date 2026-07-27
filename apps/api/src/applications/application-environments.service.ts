import { Injectable } from "@nestjs/common";
import type { ApplicationEnvironmentType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpsertApplicationEnvironmentDto } from "./dto/upsert-application-environment.dto";

@Injectable()
export class ApplicationEnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(applicationId: string) {
    return this.prisma.applicationEnvironment.findMany({
      where: { applicationId },
      orderBy: { type: "asc" },
    });
  }

  async upsert(
    applicationId: string,
    type: ApplicationEnvironmentType,
    userId: string,
    dto: UpsertApplicationEnvironmentDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.applicationEnvironment.findUnique({
      where: { applicationId_type: { applicationId, type } },
    });

    const environment = await this.prisma.applicationEnvironment.upsert({
      where: { applicationId_type: { applicationId, type } },
      create: {
        applicationId,
        type,
        baseUrl: dto.baseUrl,
        apiUrl: dto.apiUrl,
        variables: dto.variables,
        featureFlags: dto.featureFlags,
      },
      update: {
        baseUrl: dto.baseUrl,
        apiUrl: dto.apiUrl,
        variables: dto.variables,
        featureFlags: dto.featureFlags,
      },
    });

    await this.auditService.record({
      action: existing ? "APPLICATION_ENVIRONMENT_UPDATED" : "APPLICATION_ENVIRONMENT_CREATED",
      userId,
      applicationId,
      metadata: { type },
      ...meta,
    });

    return environment;
  }
}
