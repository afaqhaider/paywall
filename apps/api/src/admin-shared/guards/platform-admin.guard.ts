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
 * Phase 9 "Platform Administration & Operations Center" guard for this
 * agent's own controllers (admin-subscriptions, admin-licenses,
 * admin-financial, admin-monitoring, admin-fraud, admin-config).
 *
 * This is a deliberate, minimal, self-contained duplicate of whatever "real"
 * `PlatformAdminGuard` a sibling agent is building for the admin-core module
 * in this same phase - per the task brief, duplication across the two is
 * expected and gets resolved at merge time rather than shared now. It checks
 * exactly one thing: the authenticated user has an active (non-revoked)
 * `PlatformAdmin` row. `JwtAuthGuard` runs globally before this guard (see
 * `app.module.ts`), so `request.user` is always populated for a non-public
 * route by the time this guard runs.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; platformAdmin?: PlatformAdmin }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Authentication required");
    }

    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId: user.id } });
    if (!admin || admin.revokedAt !== null) {
      throw new ForbiddenException("Platform admin access required");
    }

    request.platformAdmin = admin;
    return true;
  }
}
