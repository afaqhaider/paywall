import { Injectable, NotFoundException } from "@nestjs/common";
import type { ProviderCredential } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret, lastFourOf } from "../common/utils/encryption.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { ResolvedAccount, ResolvedCredentials } from "./adapters/payment-provider.adapter";
import type { UpsertProviderCredentialDto } from "./dto/upsert-provider-credential.dto";

export interface ProviderCredentialMetadata {
  id: string;
  providerId: string;
  key: string;
  lastFour: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
}

function toMetadata(credential: ProviderCredential): ProviderCredentialMetadata {
  return {
    id: credential.id,
    providerId: credential.providerId,
    key: credential.key,
    lastFour: credential.lastFour,
    createdById: credential.createdById,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    rotatedAt: credential.rotatedAt,
  };
}

@Injectable()
export class ProviderCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Creates or rotates the named credential for a provider (upsert on [providerId, key]). */
  async upsert(
    providerId: string,
    userId: string,
    dto: UpsertProviderCredentialDto,
    meta: RequestMeta,
  ): Promise<ProviderCredentialMetadata> {
    const { encryptedValue, iv, authTag } = encryptSecret(dto.value);
    const existing = await this.prisma.providerCredential.findUnique({
      where: { providerId_key: { providerId, key: dto.key } },
    });

    const credential = await this.prisma.providerCredential.upsert({
      where: { providerId_key: { providerId, key: dto.key } },
      create: {
        providerId,
        key: dto.key,
        encryptedValue,
        iv,
        authTag,
        lastFour: lastFourOf(dto.value),
        createdById: userId,
      },
      update: {
        encryptedValue,
        iv,
        authTag,
        lastFour: lastFourOf(dto.value),
        rotatedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: existing ? "PROVIDER_CREDENTIAL_ROTATED" : "PROVIDER_CREDENTIAL_CREATED",
      userId,
      metadata: { providerId, credentialId: credential.id, key: credential.key },
      ...meta,
    });

    return toMetadata(credential);
  }

  async list(providerId: string): Promise<ProviderCredentialMetadata[]> {
    const credentials = await this.prisma.providerCredential.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
    });
    return credentials.map(toMetadata);
  }

  async remove(
    providerId: string,
    credentialId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const existing = await this.getOwned(providerId, credentialId);
    await this.prisma.providerCredential.delete({ where: { id: credentialId } });

    await this.auditService.record({
      action: "PROVIDER_CREDENTIAL_REMOVED",
      userId,
      metadata: { providerId, credentialId, key: existing.key },
      ...meta,
    });
  }

  /** Decrypts every credential for a provider into a flat `{ KEY: value }` bag for an adapter. Internal use only - never returned from a controller. */
  async resolveForAdapter(providerId: string): Promise<ResolvedCredentials> {
    const credentials = await this.prisma.providerCredential.findMany({ where: { providerId } });
    const resolved: ResolvedCredentials = {};
    for (const credential of credentials) {
      resolved[credential.key] = decryptSecret(credential);
    }
    return resolved;
  }

  async resolveAccount(providerId: string): Promise<ResolvedAccount | null> {
    const account = await this.prisma.providerAccount.findFirst({ where: { providerId } });
    if (!account) return null;
    return {
      externalAccountId: account.externalAccountId,
      metadata: (account.metadata as Record<string, unknown> | null) ?? undefined,
    };
  }

  private async getOwned(providerId: string, credentialId: string): Promise<ProviderCredential> {
    const credential = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
    });
    if (!credential || credential.providerId !== providerId) {
      throw new NotFoundException("Credential not found");
    }
    return credential;
  }
}
