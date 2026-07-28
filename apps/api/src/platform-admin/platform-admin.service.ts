import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PlatformAdminRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { GrantPlatformAdminDto } from "./dto/grant-platform-admin.dto";

const ADMIN_SUMMARY_SELECT = { id: true, email: true, displayName: true } as const;

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Grants platform admin authority to the user with the given email.
   * Re-granting a previously-revoked admin reactivates the same row
   * (rather than creating a second one) since `userId` is unique.
   */
  async grant(actingAdminUserId: string, dto: GrantPlatformAdminDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.userEmail } });
    if (!user) {
      throw new NotFoundException("No account exists for that email");
    }

    const existing = await this.prisma.platformAdmin.findUnique({ where: { userId: user.id } });
    if (existing && !existing.revokedAt) {
      throw new ConflictException("User is already a platform admin");
    }

    const role = dto.role ?? PlatformAdminRole.SUPER_ADMIN;
    const admin = existing
      ? await this.prisma.platformAdmin.update({
          where: { id: existing.id },
          data: {
            role,
            grantedById: actingAdminUserId,
            grantedAt: new Date(),
            revokedAt: null,
            revokedById: null,
          },
        })
      : await this.prisma.platformAdmin.create({
          data: { userId: user.id, role, grantedById: actingAdminUserId },
        });

    await this.auditService.record({
      action: "PLATFORM_ADMIN_GRANTED",
      userId: actingAdminUserId,
      metadata: { targetUserId: user.id, targetEmail: user.email, role: admin.role },
      ...meta,
    });

    return admin;
  }

  async revoke(platformAdminId: string, actingAdminUserId: string, meta: RequestMeta) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: platformAdminId } });
    if (!admin) {
      throw new NotFoundException("Platform admin grant not found");
    }
    if (admin.revokedAt) {
      throw new ConflictException("Platform admin grant is already revoked");
    }

    const revoked = await this.prisma.platformAdmin.update({
      where: { id: platformAdminId },
      data: { revokedAt: new Date(), revokedById: actingAdminUserId },
    });

    await this.auditService.record({
      action: "PLATFORM_ADMIN_REVOKED",
      userId: actingAdminUserId,
      metadata: { targetUserId: admin.userId },
      ...meta,
    });

    return revoked;
  }

  async list() {
    return this.prisma.platformAdmin.findMany({
      orderBy: { grantedAt: "desc" },
      include: {
        user: { select: ADMIN_SUMMARY_SELECT },
        grantedBy: { select: ADMIN_SUMMARY_SELECT },
        revokedBy: { select: ADMIN_SUMMARY_SELECT },
      },
    });
  }
}
