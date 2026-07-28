import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { WebhookEndpointStatus } from "@prisma/client";
import type { WebhookEndpoint, WebhookSecret } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { encryptSecret } from "../common/utils/encryption.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import type { UpdateWebhookEndpointDto } from "./dto/update-webhook-endpoint.dto";

const SECRET_PREFIX = "whsec_";

export interface WebhookSecretMetadata {
  id: string;
  lastFour: string;
  isActive: boolean;
  createdAt: Date;
  rotatedAt: Date | null;
}

/**
 * Strips `encryptedValue`/`iv`/`authTag` from a secret row - this function is
 * the ONLY place a WebhookSecret should cross a controller boundary (aside
 * from the one-time plaintext returned immediately after create/rotate).
 */
function toSecretMetadata(secret: WebhookSecret): WebhookSecretMetadata {
  return {
    id: secret.id,
    lastFour: secret.lastFour,
    isActive: secret.isActive,
    createdAt: secret.createdAt,
    rotatedAt: secret.rotatedAt,
  };
}

function generateSecretPlaintext(): string {
  return `${SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
}

@Injectable()
export class WebhookEndpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateWebhookEndpointDto,
    meta: RequestMeta,
  ): Promise<{ endpoint: WebhookEndpoint; secrets: WebhookSecretMetadata[]; secret: string }> {
    if (dto.environmentId) {
      await this.assertEnvironmentBelongsToApplication(applicationId, dto.environmentId);
    }

    const plaintext = generateSecretPlaintext();
    const { encryptedValue, iv, authTag } = encryptSecret(plaintext);

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        applicationId,
        environmentId: dto.environmentId,
        url: dto.url,
        description: dto.description,
        eventTypes: dto.eventTypes,
        createdById: userId,
        secrets: {
          create: {
            encryptedValue,
            iv,
            authTag,
            lastFour: plaintext.slice(-4),
          },
        },
      },
      include: { secrets: true },
    });

    await this.auditService.record({
      action: "WEBHOOK_ENDPOINT_CREATED",
      userId,
      applicationId,
      metadata: { webhookEndpointId: endpoint.id, url: endpoint.url },
      ...meta,
    });

    const { secrets, ...endpointFields } = endpoint;

    return {
      endpoint: endpointFields,
      secrets: secrets.map(toSecretMetadata),
      secret: plaintext,
    };
  }

  async list(applicationId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { applicationId },
      include: { secrets: true },
      orderBy: { createdAt: "desc" },
    });

    return endpoints.map(({ secrets, ...endpoint }) => ({
      ...endpoint,
      secrets: secrets.map(toSecretMetadata),
    }));
  }

  async getOne(applicationId: string, webhookEndpointId: string) {
    const endpoint = await this.getOwnedWithSecrets(applicationId, webhookEndpointId);
    const { secrets, ...rest } = endpoint;
    return { ...rest, secrets: secrets.map(toSecretMetadata) };
  }

  async update(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    dto: UpdateWebhookEndpointDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(applicationId, webhookEndpointId);

    const endpoint = await this.prisma.webhookEndpoint.update({
      where: { id: webhookEndpointId },
      data: {
        url: dto.url,
        description: dto.description,
        eventTypes: dto.eventTypes,
      },
    });

    await this.auditService.record({
      action: "WEBHOOK_ENDPOINT_UPDATED",
      userId,
      applicationId,
      metadata: { webhookEndpointId },
      ...meta,
    });

    return endpoint;
  }

  async disable(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    return this.setStatus(
      applicationId,
      webhookEndpointId,
      userId,
      WebhookEndpointStatus.DISABLED,
      "WEBHOOK_ENDPOINT_DISABLED",
      meta,
    );
  }

  async enable(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    return this.setStatus(
      applicationId,
      webhookEndpointId,
      userId,
      WebhookEndpointStatus.ENABLED,
      "WEBHOOK_ENDPOINT_ENABLED",
      meta,
    );
  }

  async remove(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    await this.getOwned(applicationId, webhookEndpointId);

    await this.prisma.webhookEndpoint.delete({ where: { id: webhookEndpointId } });

    await this.auditService.record({
      action: "WEBHOOK_ENDPOINT_DELETED",
      userId,
      applicationId,
      metadata: { webhookEndpointId },
      ...meta,
    });
  }

  async rotateSecret(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<{ secret: WebhookSecretMetadata; plaintext: string }> {
    await this.getOwned(applicationId, webhookEndpointId);

    const plaintext = generateSecretPlaintext();
    const { encryptedValue, iv, authTag } = encryptSecret(plaintext);

    const [, created] = await this.prisma.$transaction([
      this.prisma.webhookSecret.updateMany({
        where: { webhookEndpointId, isActive: true },
        data: { isActive: false, rotatedAt: new Date() },
      }),
      this.prisma.webhookSecret.create({
        data: {
          webhookEndpointId,
          encryptedValue,
          iv,
          authTag,
          lastFour: plaintext.slice(-4),
        },
      }),
    ]);

    await this.auditService.record({
      action: "WEBHOOK_SECRET_ROTATED",
      userId,
      applicationId,
      metadata: { webhookEndpointId, secretId: created.id },
      ...meta,
    });

    return { secret: toSecretMetadata(created), plaintext };
  }

  private async setStatus(
    applicationId: string,
    webhookEndpointId: string,
    userId: string,
    status: WebhookEndpointStatus,
    action: "WEBHOOK_ENDPOINT_DISABLED" | "WEBHOOK_ENDPOINT_ENABLED",
    meta: RequestMeta,
  ) {
    await this.getOwned(applicationId, webhookEndpointId);

    const endpoint = await this.prisma.webhookEndpoint.update({
      where: { id: webhookEndpointId },
      data: { status },
    });

    await this.auditService.record({
      action,
      userId,
      applicationId,
      metadata: { webhookEndpointId },
      ...meta,
    });

    return endpoint;
  }

  private async assertEnvironmentBelongsToApplication(
    applicationId: string,
    environmentId: string,
  ) {
    const environment = await this.prisma.applicationEnvironment.findUnique({
      where: { id: environmentId },
      select: { applicationId: true },
    });

    if (!environment || environment.applicationId !== applicationId) {
      throw new NotFoundException("Environment not found");
    }
  }

  private async getOwned(
    applicationId: string,
    webhookEndpointId: string,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookEndpointId },
    });

    if (!endpoint || endpoint.applicationId !== applicationId) {
      throw new NotFoundException("Webhook endpoint not found");
    }

    return endpoint;
  }

  private async getOwnedWithSecrets(
    applicationId: string,
    webhookEndpointId: string,
  ): Promise<WebhookEndpoint & { secrets: WebhookSecret[] }> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookEndpointId },
      include: { secrets: true },
    });

    if (!endpoint || endpoint.applicationId !== applicationId) {
      throw new NotFoundException("Webhook endpoint not found");
    }

    return endpoint;
  }
}
