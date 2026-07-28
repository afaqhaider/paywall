import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OAuthCredential } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { generateOAuthCredential } from "./oauth-credential.util";

/** Strips `encryptedValue`/`iv`/`authTag` - the only fields never allowed to cross a controller boundary. */
function toSafeCredential(credential: OAuthCredential) {
  const { encryptedValue: _encryptedValue, iv: _iv, authTag: _authTag, ...safe } = credential;
  return safe;
}

/**
 * Supports multiple concurrent active credentials per OAuthApplication -
 * the same pattern APIClient uses for APIKey.
 */
@Injectable()
export class OAuthCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(oauthApplicationId: string, userId: string, meta: RequestMeta) {
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);
    const generated = generateOAuthCredential();

    const credential = await this.prisma.oAuthCredential.create({
      data: {
        oauthApplicationId,
        clientId: generated.clientId,
        encryptedValue: generated.encryptedValue,
        iv: generated.iv,
        authTag: generated.authTag,
        lastFour: generated.lastFour,
      },
    });

    await this.auditService.record({
      action: "OAUTH_CREDENTIAL_CREATED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, credentialId: credential.id },
      ...meta,
    });

    return { ...toSafeCredential(credential), clientSecret: generated.plainText };
  }

  async rotate(
    oauthApplicationId: string,
    credentialId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);
    const existing = await this.getOwnedCredential(oauthApplicationId, credentialId);
    const now = new Date();

    await this.prisma.oAuthCredential.update({
      where: { id: credentialId },
      data: { revokedAt: existing.revokedAt ?? now, rotatedAt: now },
    });

    const generated = generateOAuthCredential();
    const created = await this.prisma.oAuthCredential.create({
      data: {
        oauthApplicationId,
        clientId: generated.clientId,
        encryptedValue: generated.encryptedValue,
        iv: generated.iv,
        authTag: generated.authTag,
        lastFour: generated.lastFour,
      },
    });

    await this.auditService.record({
      action: "OAUTH_CREDENTIAL_ROTATED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, oldCredentialId: credentialId, newCredentialId: created.id },
      ...meta,
    });

    return { ...toSafeCredential(created), clientSecret: generated.plainText };
  }

  async revoke(
    oauthApplicationId: string,
    credentialId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const oauthApplication = await this.getOwningApplication(oauthApplicationId);
    const existing = await this.getOwnedCredential(oauthApplicationId, credentialId);
    if (existing.revokedAt) {
      throw new BadRequestException("Credential is already revoked");
    }

    await this.prisma.oAuthCredential.update({
      where: { id: credentialId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      action: "OAUTH_CREDENTIAL_REVOKED",
      userId,
      applicationId: oauthApplication.applicationId,
      metadata: { oauthApplicationId, credentialId },
      ...meta,
    });
  }

  private async getOwningApplication(oauthApplicationId: string) {
    const oauthApplication = await this.prisma.oAuthApplication.findUnique({
      where: { id: oauthApplicationId },
      select: { applicationId: true },
    });
    if (!oauthApplication) {
      throw new NotFoundException("OAuth application not found");
    }
    return oauthApplication;
  }

  private async getOwnedCredential(
    oauthApplicationId: string,
    credentialId: string,
  ): Promise<OAuthCredential> {
    const credential = await this.prisma.oAuthCredential.findUnique({
      where: { id: credentialId },
    });
    if (!credential || credential.oauthApplicationId !== oauthApplicationId) {
      throw new NotFoundException("Credential not found");
    }
    return credential;
  }
}
