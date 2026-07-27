import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";

@Injectable()
export class ApplicationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(applicationId: string) {
    return this.prisma.applicationSetting.findMany({
      where: { applicationId },
      orderBy: { key: "asc" },
    });
  }

  async upsert(
    applicationId: string,
    key: string,
    value: Prisma.InputJsonValue,
    userId: string,
    meta: RequestMeta,
  ) {
    const setting = await this.prisma.applicationSetting.upsert({
      where: { applicationId_key: { applicationId, key } },
      create: { applicationId, key, value },
      update: { value },
    });

    await this.auditService.record({
      action: "APPLICATION_SETTING_UPDATED",
      userId,
      applicationId,
      metadata: { key },
      ...meta,
    });

    return setting;
  }

  async remove(applicationId: string, key: string, userId: string, meta: RequestMeta) {
    await this.prisma.applicationSetting.delete({
      where: { applicationId_key: { applicationId, key } },
    });

    await this.auditService.record({
      action: "APPLICATION_SETTING_UPDATED",
      userId,
      applicationId,
      metadata: { key, action: "removed" },
      ...meta,
    });
  }
}
