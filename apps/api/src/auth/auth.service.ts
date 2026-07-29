import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Prisma, Session, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuditService } from "../audit/audit.service";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../common/utils/password.util";
import { generateOpaqueToken, hashOpaqueToken } from "../common/utils/token.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { ACCESS_TOKEN_TTL_MS, PASSWORD_RESET_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./auth.constants";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { GoogleProfile } from "./strategies/google.strategy";
import type { GithubProfile } from "./strategies/github.strategy";

export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresInMs: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
}

/** Returned by `login()` instead of a `TokenPair` when the account has 2FA
 * enabled - the caller must complete `POST /auth/2fa/verify-login` with this
 * short-lived challenge token before a session is actually issued. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);

    // No transactional email provider is wired up in this environment (see
    // MailService), so there is no working verification-link flow to gate
    // on - every account is trusted at creation instead of being left
    // permanently unverified.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.firstName ? `${dto.firstName} ${dto.lastName ?? ""}`.trim() : undefined,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: "USER_REGISTERED",
      userId: user.id,
      ...meta,
    });

    return toPublicUser(user);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<TokenPair | TwoFactorChallenge> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Always run a hash comparison, even for an unknown email, so response
    // timing doesn't reveal whether the account exists.
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || !user.isActive) {
      await this.auditService.record({
        action: "LOGIN_FAILED",
        userId: user?.id,
        metadata: { email: dto.email },
        ...meta,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    const twoFactor = await this.prisma.twoFactorCredential.findUnique({
      where: { userId: user.id },
    });
    if (twoFactor && twoFactor.enabled) {
      const challengeToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: "2fa_challenge" },
        { expiresIn: "5m" },
      );
      return { twoFactorRequired: true, challengeToken };
    }

    const pair = await this.issueTokenPair(user, meta, {
      rememberMe: dto.rememberMe ?? false,
      deviceName: dto.deviceName,
    });

    await this.auditService.record({
      action: "LOGIN_SUCCEEDED",
      userId: user.id,
      ...meta,
    });

    return pair;
  }

  /**
   * Finds-or-creates a User for a verified OAuth identity (Google, GitHub).
   * Auto-links by email if an existing password account matches - the
   * provider has already verified that email, so this is the accepted
   * trade-off (documented at the point Google login was first added):
   * whoever controls that provider account gets in, without ever knowing
   * the original password.
   */
  private async loginWithOAuthProfile(
    idField: "googleId" | "githubId",
    providerId: string,
    profile: {
      email: string;
      emailVerified: boolean;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    },
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const providerWhere: Prisma.UserWhereUniqueInput =
      idField === "googleId" ? { googleId: providerId } : { githubId: providerId };

    let user = await this.prisma.user.findUnique({ where: providerWhere });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      const providerIdData: { googleId?: string; githubId?: string } =
        idField === "googleId" ? { googleId: providerId } : { githubId: providerId };

      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            ...providerIdData,
            emailVerified: existingByEmail.emailVerified || profile.emailVerified,
            emailVerifiedAt:
              existingByEmail.emailVerifiedAt ?? (profile.emailVerified ? new Date() : undefined),
            avatarUrl: existingByEmail.avatarUrl ?? profile.avatarUrl,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            ...providerIdData,
            emailVerified: profile.emailVerified,
            emailVerifiedAt: profile.emailVerified ? new Date() : undefined,
            firstName: profile.firstName,
            lastName: profile.lastName,
            displayName: profile.firstName
              ? `${profile.firstName} ${profile.lastName ?? ""}`.trim()
              : undefined,
            avatarUrl: profile.avatarUrl,
          },
        });

        await this.auditService.record({ action: "USER_REGISTERED", userId: user.id, ...meta });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException("This account has been deactivated");
    }

    const pair = await this.issueTokenPair(user, meta, { rememberMe: true });

    await this.auditService.record({ action: "LOGIN_SUCCEEDED", userId: user.id, ...meta });

    return pair;
  }

  async loginWithGoogle(profile: GoogleProfile, meta: RequestMeta): Promise<TokenPair> {
    return this.loginWithOAuthProfile("googleId", profile.googleId, profile, meta);
  }

  async loginWithGithub(profile: GithubProfile, meta: RequestMeta): Promise<TokenPair> {
    return this.loginWithOAuthProfile("githubId", profile.githubId, profile, meta);
  }

  async issueTokenPair(
    user: User,
    meta: RequestMeta,
    options: { rememberMe: boolean; deviceName?: string; replaces?: Session },
  ): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email });
    const { token: refreshToken, tokenHash } = generateOpaqueToken();
    const ttl = options.rememberMe ? REFRESH_TOKEN_TTL_MS.rememberMe : REFRESH_TOKEN_TTL_MS.default;
    const refreshTokenExpiresAt = new Date(Date.now() + ttl);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: tokenHash,
        rememberMe: options.rememberMe,
        deviceName: options.deviceName,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    if (options.replaces) {
      await this.prisma.session.update({
        where: { id: options.replaces.id },
        data: { revokedAt: new Date(), replacedById: session.id },
      });
    }

    return {
      accessToken,
      accessTokenExpiresInMs: ACCESS_TOKEN_TTL_MS,
      refreshToken,
      refreshTokenExpiresAt,
      user: toPublicUser(user),
    };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid session");
    }

    if (session.revokedAt) {
      // A previously-rotated-out (or already revoked) token was replayed:
      // treat this as token theft and kill every active session for the user.
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}`);
      await this.revokeAllSessions(session.userId);
      await this.auditService.record({
        action: "SESSION_REVOKED",
        userId: session.userId,
        metadata: { reason: "refresh_token_reuse_detected" },
        ...meta,
      });
      throw new UnauthorizedException("Session revoked");
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    return this.issueTokenPair(session.user, meta, {
      rememberMe: session.rememberMe,
      deviceName: session.deviceName ?? undefined,
      replaces: session,
    });
  }

  async logout(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await this.auditService.record({
        action: "LOGOUT",
        userId: session.userId,
        ...meta,
      });
    }
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        rememberMe: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new BadRequestException("Session not found");
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({ action: "SESSION_REVOKED", userId, ...meta });
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    await this.auditService.record({
      action: "PASSWORD_RESET_REQUESTED",
      userId: user?.id,
      metadata: { email },
      ...meta,
    });

    // Always behave the same way whether or not the account exists, so the
    // response can't be used to enumerate registered emails.
    if (!user || !user.isActive) {
      return;
    }

    const { token, tokenHash } = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const resetUrl = `${this.webOrigin()}/reset-password?token=${token}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(rawToken: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ]);

    await this.revokeAllSessions(record.userId);

    await this.auditService.record({
      action: "PASSWORD_RESET_COMPLETED",
      userId: record.userId,
      ...meta,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matches = await verifyPassword(currentPassword, user.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!matches) {
      throw new BadRequestException("Current password is incorrect");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.revokeAllSessions(userId);

    await this.auditService.record({
      action: "PASSWORD_CHANGED",
      userId,
      ...meta,
    });
  }

  private webOrigin(): string {
    return process.env.WEB_ORIGIN ?? "http://localhost:3000";
  }
}
