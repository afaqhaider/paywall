import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { PlatformAdmin } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

/**
 * Platform-wide (NOT organization/application-scoped) authorization gate for
 * every `admin/*` route across all of Phase 9. Passes only for a signed-in
 * User with an active (`revokedAt IS NULL`) `PlatformAdmin` row.
 *
 * Deliberately simpler than OrganizationRoleGuard/ApplicationRoleGuard:
 * there is no `@RequirePlatformAdmin()` metadata to opt into, and no role
 * hierarchy to check (today there is exactly one `PlatformAdminRole`,
 * `SUPER_ADMIN`). Every Phase 9 admin controller applies this guard directly
 * at the class level - `@UseGuards(PlatformAdminGuard)` - which is the one
 * pattern every sibling module should copy verbatim.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Platform admin authority required");
    }

    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId: user.id } });

    if (!admin || admin.revokedAt) {
      throw new ForbiddenException("Platform admin authority required");
    }

    (request as Request & { platformAdmin?: PlatformAdmin }).platformAdmin = admin;

    return true;
  }
}
