import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

const PROFILE_SELECT = {
  id: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatarUrl: true,
  timezone: true,
  language: true,
  country: true,
  phone: true,
  createdAt: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_SELECT });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, meta: RequestMeta) {
    const profile = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PROFILE_SELECT,
    });

    await this.auditService.record({
      action: "PROFILE_UPDATED",
      userId,
      metadata: { fields: Object.keys(dto) },
      ...meta,
    });

    return profile;
  }
}
