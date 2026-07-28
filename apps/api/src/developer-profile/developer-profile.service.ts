import { Injectable } from "@nestjs/common";
import type { DeveloperProfile } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpdateDeveloperProfileDto } from "./dto/update-developer-profile.dto";

@Injectable()
export class DeveloperProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Get-or-create: lazily creates an empty row on first access. */
  async getOrCreate(userId: string): Promise<DeveloperProfile> {
    return this.prisma.developerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(
    userId: string,
    dto: UpdateDeveloperProfileDto,
    meta: RequestMeta,
  ): Promise<DeveloperProfile> {
    const profile = await this.prisma.developerProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    await this.auditService.record({
      action: "DEVELOPER_PROFILE_UPDATED",
      userId,
      metadata: { fields: Object.keys(dto) },
      ...meta,
    });

    return profile;
  }
}
