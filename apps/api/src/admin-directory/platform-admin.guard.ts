import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Minimal, self-contained "is this user an active platform admin" guard.
 *
 * Agent A owns the canonical `PlatformAdminGuard` for this phase (expected
 * under `apps/api/src/platform-admin/` or `common/guards/`). This worktree
 * cannot import a sibling agent's not-yet-existing class, so this is a
 * deliberately near-identical, independently-built equivalent scoped to
 * this module's own controllers. It is expected to be deduplicated at
 * merge time in favor of whichever copy is cleaner - keep this in mind and
 * do not build divergent behavior on top of it.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Platform admin access required");
    }

    const admin = await this.prisma.platformAdmin.findUnique({ where: { userId: user.id } });

    if (!admin || admin.revokedAt) {
      throw new ForbiddenException("Platform admin access required");
    }

    return true;
  }
}
