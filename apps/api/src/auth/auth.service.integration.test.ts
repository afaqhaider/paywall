import { randomUUID } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuditService } from "../audit/audit.service";
import { AuthService, type TokenPair } from "./auth.service";

/**
 * `AuthService.login()` now returns `TokenPair | TwoFactorChallenge` (Phase
 * 8 adds an opt-in 2FA branch) - every account exercised by this suite has
 * 2FA disabled (the default), so a successful login is always a `TokenPair`
 * in practice. This just narrows the type for the assertions below without
 * weakening them.
 */
function expectTokenPair(result: TokenPair | { twoFactorRequired: true }): TokenPair {
  if (!("accessToken" in result)) {
    throw new Error("Expected a TokenPair, got a two-factor challenge");
  }
  return result;
}

/**
 * Exercises the real register/login/refresh-rotation/reuse-detection flow
 * against a real local PostgreSQL instance (no mocks) — the same database
 * driven manually during development. Requires DATABASE_URL to point at a
 * reachable Postgres (see docker-compose.yml / CI's postgres service).
 */
describe("AuthService (integration)", () => {
  const prisma = new PrismaService();
  const jwtService = new JwtService({
    secret: "test-only-secret-do-not-use-in-prod",
    signOptions: { expiresIn: "15m" },
  });
  const mailService = new MailService();
  const auditService = new AuditService(prisma);
  const authService = new AuthService(prisma, jwtService, mailService, auditService);

  const testEmailSuffix = `+${randomUUID()}@authtest.local`;
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };

  function email(prefix: string): string {
    return `${prefix}${testEmailSuffix}`;
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: testEmailSuffix } } });
    await prisma.$disconnect();
  });

  it("registers a user and rejects a duplicate email", async () => {
    const registerEmail = email("register");
    const user = await authService.register(
      { email: registerEmail, password: "SuperSecret123!" },
      meta,
    );

    expect(user.email).toBe(registerEmail);
    // No transactional email provider is wired up, so there is no working
    // verification-link flow to gate on - every account is trusted at
    // creation (see AuthService.register).
    expect(user.emailVerified).toBe(true);

    await expect(
      authService.register({ email: registerEmail, password: "SuperSecret123!" }, meta),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    const loginEmail = email("login");
    await authService.register({ email: loginEmail, password: "SuperSecret123!" }, meta);

    const pair = expectTokenPair(
      await authService.login({ email: loginEmail, password: "SuperSecret123!" }, meta),
    );
    expect(pair.accessToken).toBeTruthy();
    expect(pair.user.email).toBe(loginEmail);

    await expect(
      authService.login({ email: loginEmail, password: "WrongPassword!" }, meta),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects login for an unknown email without leaking existence", async () => {
    await expect(
      authService.login({ email: email("does-not-exist"), password: "whatever123!" }, meta),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotates refresh tokens and detects reuse of a rotated-out token", async () => {
    const loginEmail = email("rotate");
    await authService.register({ email: loginEmail, password: "SuperSecret123!" }, meta);
    const first = expectTokenPair(
      await authService.login({ email: loginEmail, password: "SuperSecret123!" }, meta),
    );

    const rotated = await authService.refresh(first.refreshToken, meta);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    // Replaying the original (now rotated-out) refresh token must fail...
    await expect(authService.refresh(first.refreshToken, meta)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // ...and must have revoked the entire session chain, including the token
    // that was legitimately issued by the rotation above.
    await expect(authService.refresh(rotated.refreshToken, meta)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("resets a forgotten password and revokes existing sessions", async () => {
    const resetEmail = email("reset");
    await authService.register({ email: resetEmail, password: "OldPassword123!" }, meta);
    const session = expectTokenPair(
      await authService.login({ email: resetEmail, password: "OldPassword123!" }, meta),
    );

    await authService.forgotPassword(resetEmail, meta);
    const record = await prisma.passwordResetToken.findFirstOrThrow({
      where: { user: { email: resetEmail } },
      orderBy: { createdAt: "desc" },
    });

    // The service only ever sees the raw token (mailed out, never stored) —
    // simulate possession of it by minting one whose hash we overwrite in place.
    const rawToken = "integration-test-raw-reset-token";
    const { hashOpaqueToken } = await import("../common/utils/token.util");
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { tokenHash: hashOpaqueToken(rawToken) },
    });

    await authService.resetPassword(rawToken, "BrandNewPassword123!", meta);

    await expect(
      authService.login({ email: resetEmail, password: "OldPassword123!" }, meta),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const relogin = expectTokenPair(
      await authService.login({ email: resetEmail, password: "BrandNewPassword123!" }, meta),
    );
    expect(relogin.accessToken).toBeTruthy();

    // The pre-reset session must have been revoked.
    await expect(authService.refresh(session.refreshToken, meta)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
