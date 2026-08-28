import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { TwoFactorCredential } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { decryptSecret, encryptSecret } from "../common/utils/encryption.util";
import { hashOpaqueToken } from "../common/utils/token.util";
import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  generateRecoveryCode,
  generateTotpSecret,
  verifyTotp,
} from "./totp.util";

const RECOVERY_CODE_COUNT = 8;
const ISSUER = "SSCodeAxis";

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Generates a new (not-yet-enabled) TOTP secret and returns the otpauth://
   * URL for the user to scan/enter. Calling this again before `verify()`
   * simply replaces the pending secret - nothing is enabled until verified.
   */
  async setup(userId: string, email: string) {
    const secret = generateTotpSecret();
    const secretBase32 = base32Encode(secret);
    const encrypted = encryptSecret(secretBase32);

    await this.prisma.twoFactorCredential.upsert({
      where: { userId },
      create: {
        userId,
        encryptedSecret: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        recoveryCodesHash: [],
        enabled: false,
      },
      update: {
        encryptedSecret: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        enabled: false,
        verifiedAt: null,
        recoveryCodesHash: [],
      },
    });

    return {
      secret: secretBase32,
      otpauthUrl: buildOtpauthUrl({ email, secretBase32, issuer: ISSUER }),
    };
  }

  /**
   * Confirms the pending secret with a real TOTP code, enables 2FA, and
   * mints the one-time recovery codes (shown in plaintext exactly once -
   * only their hashes are ever persisted).
   */
  async verify(userId: string, code: string, meta: RequestMeta) {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential) {
      throw new NotFoundException("No two-factor setup in progress - call setup first");
    }

    if (!verifyTotp(this.decryptCredentialSecret(credential), code)) {
      throw new UnauthorizedException("Invalid verification code");
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
    const recoveryCodesHash = recoveryCodes.map((c) => hashOpaqueToken(c));

    await this.prisma.twoFactorCredential.update({
      where: { userId },
      data: { enabled: true, verifiedAt: new Date(), recoveryCodesHash },
    });

    await this.auditService.record({ action: "TWO_FACTOR_ENABLED", userId, ...meta });

    return { recoveryCodes };
  }

  /** Disables 2FA after verifying a current TOTP code (or an unused recovery code). Row is kept (not deleted) so re-enabling starts from a fresh `setup()` call. */
  async disable(userId: string, code: string, meta: RequestMeta) {
    const credential = await this.getEnabledCredential(userId);
    const valid = await this.checkCodeOrRecovery(credential, code);
    if (!valid) {
      throw new UnauthorizedException("Invalid verification code");
    }

    await this.prisma.twoFactorCredential.update({
      where: { userId },
      data: { enabled: false },
    });

    await this.auditService.record({ action: "TWO_FACTOR_DISABLED", userId, ...meta });
  }

  /** Backs `GET /customer-portal/me/security`: 2FA status, active sessions, and recent audit activity. */
  async getSecurityOverview(userId: string) {
    const [credential, sessions, recentActivity] = await Promise.all([
      this.prisma.twoFactorCredential.findUnique({ where: { userId } }),
      this.authService.listSessions(userId),
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      twoFactorEnabled: credential?.enabled ?? false,
      sessions,
      recentActivity,
    };
  }

  /** Verifies a login-time TOTP/recovery code against the given user's enabled credential - used by `/auth/2fa/verify-login`. */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential || !credential.enabled) {
      return false;
    }
    return this.checkCodeOrRecovery(credential, code);
  }

  private async getEnabledCredential(userId: string): Promise<TwoFactorCredential> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential || !credential.enabled) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }
    return credential;
  }

  private decryptCredentialSecret(credential: TwoFactorCredential): Buffer {
    const secretBase32 = decryptSecret({
      encryptedValue: credential.encryptedSecret,
      iv: credential.iv,
      authTag: credential.authTag,
    });
    return base32Decode(secretBase32);
  }

  /** Checks a TOTP code first, then falls back to a recovery code - consuming it (removing it from the stored array) on success so it can never be reused. */
  private async checkCodeOrRecovery(
    credential: TwoFactorCredential,
    code: string,
  ): Promise<boolean> {
    if (verifyTotp(this.decryptCredentialSecret(credential), code)) {
      return true;
    }

    const hashes = Array.isArray(credential.recoveryCodesHash)
      ? (credential.recoveryCodesHash as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const codeHash = hashOpaqueToken(code.trim().toUpperCase());
    const index = hashes.indexOf(codeHash);
    if (index === -1) {
      return false;
    }

    const remaining = hashes.filter((_, i) => i !== index);
    await this.prisma.twoFactorCredential.update({
      where: { id: credential.id },
      data: { recoveryCodesHash: remaining },
    });
    return true;
  }
}
