import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpsertEnvironmentVariableDto } from "./dto/upsert-environment-variable.dto";

@Injectable()
export class EnvironmentVariablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(applicationId: string, environmentId: string) {
    await this.getOwnedEnvironment(applicationId, environmentId);

    return this.prisma.environmentVariable.findMany({
      where: { environmentId },
      orderBy: { key: "asc" },
    });
  }

  async upsert(
    applicationId: string,
    environmentId: string,
    key: string,
    dto: UpsertEnvironmentVariableDto,
    userId: string,
    meta: RequestMeta,
  ) {
    await this.getOwnedEnvironment(applicationId, environmentId);

    const variable = await this.prisma.environmentVariable.upsert({
      where: { environmentId_key: { environmentId, key } },
      create: {
        environmentId,
        key,
        value: dto.value,
        isSecret: dto.isSecret ?? false,
        createdById: userId,
      },
      update: {
        value: dto.value,
        isSecret: dto.isSecret ?? false,
      },
    });

    await this.auditService.record({
      action: "ENVIRONMENT_VARIABLE_SET",
      userId,
      applicationId,
      metadata: { key, isSecret: variable.isSecret },
      ...meta,
    });

    return variable;
  }

  async remove(
    applicationId: string,
    environmentId: string,
    key: string,
    userId: string,
    meta: RequestMeta,
  ) {
    await this.getOwnedEnvironment(applicationId, environmentId);

    const existing = await this.prisma.environmentVariable.findUnique({
      where: { environmentId_key: { environmentId, key } },
    });
    if (!existing) {
      throw new NotFoundException("Environment variable not found");
    }

    await this.prisma.environmentVariable.delete({
      where: { environmentId_key: { environmentId, key } },
    });

    await this.auditService.record({
      action: "ENVIRONMENT_VARIABLE_REMOVED",
      userId,
      applicationId,
      metadata: { key },
      ...meta,
    });
  }

  private async getOwnedEnvironment(applicationId: string, environmentId: string) {
    const environment = await this.prisma.applicationEnvironment.findUnique({
      where: { id: environmentId },
    });
    if (!environment || environment.applicationId !== applicationId) {
      throw new NotFoundException("Environment not found");
    }
    return environment;
  }
}
