import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ImpersonationTargetRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService, type TokenPair } from "../auth/auth.service";
import { PASSWORD_RESET_TTL_MS } from "../auth/auth.constants";
import { generateOpaqueToken, hashOpaqueToken } from "../common/utils/token.util";
import { normalizePageSize } from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { ImpersonateDto } from "./dto/impersonate.dto";
import type { LoginLinkDto } from "./dto/login-link.dto";

const IMPERSONATION_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Mints a short-lived, one-shot `ImpersonationSession` token for
   * `POST /admin/support/impersonate/:token/redeem` to exchange for a real
   * session. The raw token is returned exactly once here and never again -
   * only its hash is persisted, same as every other opaque token in this
   * codebase.
   */
  async impersonate(
    targetUserId: string,
    adminUserId: string,
    dto: ImpersonateDto,
    meta: RequestMeta,
  ) {
    const targetUser = await this.getUserOrThrow(targetUserId);
    const { token, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + IMPERSONATION_TOKEN_TTL_MS);

    await this.prisma.impersonationSession.create({
      data: {
        adminUserId,
        targetUserId: targetUser.id,
        targetRole: dto.targetRole,
        tokenHash,
        reason: dto.reason,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    await this.auditService.record({
      action: "ADMIN_IMPERSONATION_STARTED",
      userId: adminUserId,
      metadata: { targetUserId: targetUser.id, targetRole: dto.targetRole, reason: dto.reason },
      ...meta,
    });

    return { impersonationToken: token, expiresAt };
  }

  /**
   * Exchanges a still-valid impersonation token for a real token pair for
   * the target user. Still behind `PlatformAdminGuard` - only the admin who
   * just generated the token is expected to call this immediately
   * client-side. `endedAt` is intentionally left unset here: ending an
   * impersonation session isn't modeled as a separate explicit call in this
   * phase, the session simply expires (`expiresAt`, 15 minutes from
   * `impersonate()`) - `endedAt` exists on the model for a future "stop
   * impersonating" action but nothing currently sets it.
   */
  async redeem(rawToken: string, meta: RequestMeta): Promise<TokenPair> {
    const tokenHash = hashOpaqueToken(rawToken);
    const session = await this.prisma.impersonationSession.findUnique({
      where: { tokenHash },
      include: { target: true },
    });

    if (!session || session.endedAt || session.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired impersonation token");
    }

    return this.authService.issueTokenPair(session.target, meta, { rememberMe: false });
  }

  /** Same underlying mechanism as `impersonate()` - a shareable one-time login link rather than an immediate redeem-in-place. */
  async createLoginLink(
    targetUserId: string,
    adminUserId: string,
    dto: LoginLinkDto,
    meta: RequestMeta,
  ) {
    const targetUser = await this.getUserOrThrow(targetUserId);
    const { token, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + IMPERSONATION_TOKEN_TTL_MS);

    await this.prisma.impersonationSession.create({
      data: {
        adminUserId,
        targetUserId: targetUser.id,
        targetRole: dto.targetRole ?? ImpersonationTargetRole.CUSTOMER,
        tokenHash,
        reason: dto.reason,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    await this.auditService.record({
      action: "ADMIN_LOGIN_LINK_GENERATED",
      userId: adminUserId,
      metadata: { targetUserId: targetUser.id, reason: dto.reason },
      ...meta,
    });

    return {
      loginUrl: `${this.webOrigin()}/admin-login?token=${token}`,
      expiresAt,
    };
  }

  /** Simple `startedAt`-keyed cursor - `ImpersonationSession` has no `createdAt` column (it has `startedAt` instead), so the shared `createdAt`-based cursor-pagination util doesn't apply directly here. */
  async listImpersonationHistory(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = query.cursor ? decodeStartedAtCursor(query.cursor) : undefined;

    const rows = await this.prisma.impersonationSession.findMany({
      where: cursorWhere,
      include: {
        admin: { select: { id: true, email: true, displayName: true } },
        target: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeStartedAtCursor(last) : null;

    return { items, nextCursor };
  }

  async unlockUser(userId: string, adminUserId: string, meta: RequestMeta) {
    const user = await this.getUserOrThrow(userId);

    if (!user.isActive) {
      await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    }

    await this.auditService.record({
      action: "ADMIN_ACCOUNT_UNLOCKED",
      userId: adminUserId,
      metadata: { targetUserId: userId },
      ...meta,
    });
  }

  /** Admin-initiated reset: creates a `PasswordResetToken` and hands back the reset link (same mechanism as `AuthService.forgotPassword`) rather than setting a password directly - no plaintext password ever passes through the admin. */
  async resetPassword(userId: string, adminUserId: string, meta: RequestMeta) {
    const user = await this.getUserOrThrow(userId);
    const { token, tokenHash } = generateOpaqueToken();

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    });

    await this.auditService.record({
      action: "ADMIN_PASSWORD_RESET",
      userId: adminUserId,
      metadata: { targetUserId: userId },
      ...meta,
    });

    return { resetUrl: `${this.webOrigin()}/reset-password?token=${token}` };
  }

  /** Deletes the row rather than merely disabling it - re-enabling 2FA always needs a fresh `setup()` secret anyway, so there's nothing worth keeping. */
  async reset2fa(userId: string, adminUserId: string, meta: RequestMeta) {
    await this.getUserOrThrow(userId);
    await this.prisma.twoFactorCredential.deleteMany({ where: { userId } });

    await this.auditService.record({
      action: "CUSTOMER_2FA_RESET_BY_ADMIN",
      userId: adminUserId,
      metadata: { targetUserId: userId },
      ...meta,
    });
  }

  /** Bulk-revokes every active session - this single action covers both "Force logout" and "Invalidate sessions" from the spec. */
  async invalidateSessions(userId: string, adminUserId: string, meta: RequestMeta) {
    await this.getUserOrThrow(userId);

    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      action: "ADMIN_SESSIONS_INVALIDATED",
      userId: adminUserId,
      metadata: { targetUserId: userId, sessionsRevoked: count },
      ...meta,
    });

    return { sessionsRevoked: count };
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private webOrigin(): string {
    return process.env.WEB_ORIGIN ?? "http://localhost:3000";
  }
}

function encodeStartedAtCursor(item: { id: string; startedAt: Date }): string {
  return Buffer.from(`${item.startedAt.toISOString()}|${item.id}`).toString("base64url");
}

function decodeStartedAtCursor(cursor: string) {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [startedAt, id] = decoded.split("|");
  if (!startedAt || !id || Number.isNaN(Date.parse(startedAt))) {
    throw new BadRequestException("Invalid pagination cursor");
  }
  return {
    OR: [
      { startedAt: { lt: new Date(startedAt) } },
      { startedAt: new Date(startedAt), id: { lt: id } },
    ],
  };
}
