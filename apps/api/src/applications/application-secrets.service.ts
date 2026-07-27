import { Injectable, NotFoundException } from "@nestjs/common";
import type { ApplicationSecret } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret, lastFourOf } from "../common/utils/encryption.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateApplicationSecretDto } from "./dto/create-application-secret.dto";
import type { RotateApplicationSecretDto } from "./dto/rotate-application-secret.dto";

export interface ApplicationSecretMetadata {
  id: string;
  applicationId: string;
  environmentId: string | null;
  type: string;
  key: string;
  lastFour: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
}

/**
 * Strips `encryptedValue`/`iv`/`authTag` from a secret row - this function
 * is the ONLY place a secret should cross a controller boundary. Never
 * return an `ApplicationSecret` (the Prisma model) directly from a handler.
 */
function toMetadata(secret: ApplicationSecret): ApplicationSecretMetadata {
  return {
    id: secret.id,
    applicationId: secret.applicationId,
    environmentId: secret.environmentId,
    type: secret.type,
    key: secret.key,
    lastFour: secret.lastFour,
    createdById: secret.createdById,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    rotatedAt: secret.rotatedAt,
  };
}

@Injectable()
export class ApplicationSecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateApplicationSecretDto,
    meta: RequestMeta,
  ): Promise<ApplicationSecretMetadata> {
    const { encryptedValue, iv, authTag } = encryptSecret(dto.value);

    const secret = await this.prisma.applicationSecret.create({
      data: {
        applicationId,
        environmentId: dto.environmentId,
        type: dto.type,
        key: dto.key,
        encryptedValue,
        iv,
        authTag,
        lastFour: lastFourOf(dto.value),
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "APPLICATION_SECRET_CREATED",
      userId,
      applicationId,
      metadata: { secretId: secret.id, key: secret.key, type: secret.type },
      ...meta,
    });

    return toMetadata(secret);
  }

  async list(applicationId: string): Promise<ApplicationSecretMetadata[]> {
    const secrets = await this.prisma.applicationSecret.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });

    return secrets.map(toMetadata);
  }

  async rotate(
    applicationId: string,
    secretId: string,
    userId: string,
    dto: RotateApplicationSecretDto,
    meta: RequestMeta,
  ): Promise<ApplicationSecretMetadata> {
    const existing = await this.getOneOrThrow(applicationId, secretId);
    const { encryptedValue, iv, authTag } = encryptSecret(dto.value);

    const secret = await this.prisma.applicationSecret.update({
      where: { id: secretId },
      data: { encryptedValue, iv, authTag, lastFour: lastFourOf(dto.value), rotatedAt: new Date() },
    });

    await this.auditService.record({
      action: "APPLICATION_SECRET_ROTATED",
      userId,
      applicationId,
      metadata: { secretId, key: existing.key },
      ...meta,
    });

    return toMetadata(secret);
  }

  async remove(applicationId: string, secretId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOneOrThrow(applicationId, secretId);
    await this.prisma.applicationSecret.delete({ where: { id: secretId } });

    await this.auditService.record({
      action: "APPLICATION_SECRET_REMOVED",
      userId,
      applicationId,
      metadata: { secretId, key: existing.key },
      ...meta,
    });
  }

  /**
   * Decrypts and returns the plaintext value for internal server-side use
   * only (e.g. a future integration calling a third-party API with this
   * secret). MUST NEVER be returned from a controller.
   */
  async decryptForInternalUse(applicationId: string, secretId: string): Promise<string> {
    const secret = await this.getOneOrThrow(applicationId, secretId);
    return decryptSecret(secret);
  }

  private async getOneOrThrow(applicationId: string, secretId: string): Promise<ApplicationSecret> {
    const secret = await this.prisma.applicationSecret.findUnique({ where: { id: secretId } });
    if (!secret || secret.applicationId !== applicationId) {
      throw new NotFoundException("Secret not found");
    }
    return secret;
  }
}
