import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ERPConnectionStatus, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret, lastFourOf } from "../common/utils/encryption.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateErpConnectionDto } from "./dto/create-erp-connection.dto";
import type { UpdateErpConnectionDto } from "./dto/update-erp-connection.dto";
import type { RotateErpConnectionKeyDto } from "./dto/rotate-erp-connection-key.dto";
import type { UpdateErpPermissionsDto } from "./dto/update-erp-permissions.dto";
import {
  toSafeConnection,
  toSafePermission,
  type ErpConnectionWithRelations,
  type SafeErpConnection,
  type SafeErpPermission,
} from "./financial-integration.serializers";

const CONNECTION_INCLUDE = {
  company: true,
  configuration: { include: { permissions: true } },
} as const;

export interface ErpConnectionTestResult extends SafeErpConnection {
  error?: string;
}

@Injectable()
export class ErpConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateErpConnectionDto,
    meta: RequestMeta,
  ): Promise<SafeErpConnection> {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
      include: { erpConnection: true },
    });

    if (!integration || integration.provider !== "LEDGIX_ERP") {
      throw new BadRequestException(
        "Organization must select the LEDGIX_ERP provider before creating an ERP connection",
      );
    }

    if (integration.erpConnection) {
      throw new BadRequestException(
        "An ERP connection already exists for this organization - use PATCH to update it or the rotate-key endpoint to rotate its credential",
      );
    }

    const { encryptedValue, iv, authTag } = encryptSecret(dto.apiKey);

    const connection = await this.prisma.eRPConnection.create({
      data: {
        financialIntegrationId: integration.id,
        baseUrl: dto.baseUrl,
        companyId: dto.companyId,
        encryptedApiKey: encryptedValue,
        iv,
        authTag,
        lastFour: lastFourOf(dto.apiKey),
        status: ERPConnectionStatus.PENDING_TEST,
        createdById: userId,
      },
      include: CONNECTION_INCLUDE,
    });

    await this.auditService.record({
      action: "ERP_CONNECTION_CREATED",
      userId,
      organizationId,
      metadata: { erpConnectionId: connection.id, baseUrl: connection.baseUrl },
      ...meta,
    });

    return toSafeConnection(connection);
  }

  async update(
    organizationId: string,
    userId: string,
    dto: UpdateErpConnectionDto,
    meta: RequestMeta,
  ): Promise<SafeErpConnection> {
    const existing = await this.getConnectionOrThrow(organizationId);

    const connection = await this.prisma.eRPConnection.update({
      where: { id: existing.id },
      data: {
        baseUrl: dto.baseUrl ?? undefined,
        companyId: dto.companyId ?? undefined,
      },
      include: CONNECTION_INCLUDE,
    });

    await this.auditService.record({
      action: "ERP_CONNECTION_UPDATED",
      userId,
      organizationId,
      metadata: { erpConnectionId: connection.id, baseUrl: dto.baseUrl, companyId: dto.companyId },
      ...meta,
    });

    return toSafeConnection(connection);
  }

  /**
   * Lightweight connectivity check owned entirely by this module - NOT the
   * full ERP connector/sync engine (that lives in a sibling agent's
   * `erp-connector` module and is never called from here).
   *
   * Assumed LedGix REST shape (undocumented / no real instance to verify
   * against, so this is a best-effort placeholder the connector team can
   * correct later): a GET to
   *   `${baseUrl}/api/${apiVersion}/companies/${companyId}`
   * authenticated with `Authorization: Bearer <apiKey>`, returning JSON that
   * looks roughly like `{ id, name, baseCurrency }` on success.
   */
  async test(
    organizationId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<ErpConnectionTestResult> {
    const existing = await this.getConnectionOrThrow(organizationId);
    const apiKey = decryptSecret({
      encryptedValue: existing.encryptedApiKey,
      iv: existing.iv,
      authTag: existing.authTag,
    });

    const url = `${existing.baseUrl.replace(/\/+$/, "")}/api/${existing.apiVersion}/companies/${existing.companyId}`;

    let success = false;
    let errorMessage: string | undefined;
    let body: Record<string, unknown> | undefined;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        errorMessage = `LedGix responded with HTTP ${response.status}`;
      } else {
        body = (await response.json()) as Record<string, unknown>;
        success = true;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error contacting LedGix";
    }

    const now = new Date();
    let connection: ErpConnectionWithRelations;

    if (success && body) {
      const externalCompanyId = String(body.id ?? body.companyId ?? existing.companyId);
      const name = typeof body.name === "string" ? body.name : undefined;
      const baseCurrency = typeof body.baseCurrency === "string" ? body.baseCurrency : undefined;

      connection = await this.prisma.eRPConnection.update({
        where: { id: existing.id },
        data: {
          status: ERPConnectionStatus.CONNECTED,
          lastTestedAt: now,
          lastTestResult: { success: true, checkedAt: now.toISOString() },
          company: {
            upsert: {
              create: {
                externalCompanyId,
                name,
                baseCurrency,
                raw: body as Prisma.InputJsonValue,
                fetchedAt: now,
              },
              update: {
                externalCompanyId,
                name,
                baseCurrency,
                raw: body as Prisma.InputJsonValue,
                fetchedAt: now,
              },
            },
          },
        },
        include: CONNECTION_INCLUDE,
      });
    } else {
      connection = await this.prisma.eRPConnection.update({
        where: { id: existing.id },
        data: {
          status: ERPConnectionStatus.FAILED,
          lastTestedAt: now,
          lastTestResult: { success: false, error: errorMessage, checkedAt: now.toISOString() },
        },
        include: CONNECTION_INCLUDE,
      });
    }

    await this.auditService.record({
      action: "ERP_CONNECTION_TESTED",
      userId,
      organizationId,
      metadata: { erpConnectionId: connection.id, success, error: errorMessage },
      ...meta,
    });

    return { ...toSafeConnection(connection), error: success ? undefined : errorMessage };
  }

  async rotateKey(
    organizationId: string,
    userId: string,
    dto: RotateErpConnectionKeyDto,
    meta: RequestMeta,
  ): Promise<SafeErpConnection> {
    const existing = await this.getConnectionOrThrow(organizationId);
    const { encryptedValue, iv, authTag } = encryptSecret(dto.apiKey);

    const connection = await this.prisma.eRPConnection.update({
      where: { id: existing.id },
      data: {
        encryptedApiKey: encryptedValue,
        iv,
        authTag,
        lastFour: lastFourOf(dto.apiKey),
        rotatedAt: new Date(),
        status: ERPConnectionStatus.PENDING_TEST,
      },
      include: CONNECTION_INCLUDE,
    });

    await this.auditService.record({
      action: "ERP_CONNECTION_CREDENTIAL_ROTATED",
      userId,
      organizationId,
      metadata: { erpConnectionId: connection.id },
      ...meta,
    });

    return toSafeConnection(connection);
  }

  async disconnect(organizationId: string, userId: string, meta: RequestMeta): Promise<void> {
    const existing = await this.getConnectionOrThrow(organizationId);

    await this.prisma.eRPConnection.update({
      where: { id: existing.id },
      data: { status: ERPConnectionStatus.DISCONNECTED },
    });

    await this.auditService.record({
      action: "ERP_CONNECTION_DISCONNECTED",
      userId,
      organizationId,
      metadata: { erpConnectionId: existing.id },
      ...meta,
    });
  }

  async getPermissions(organizationId: string): Promise<SafeErpPermission[]> {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
      include: {
        erpConnection: { include: { configuration: { include: { permissions: true } } } },
      },
    });

    const connection = integration?.erpConnection;
    if (!connection) {
      return [];
    }

    if (connection.configuration) {
      return connection.configuration.permissions.map(toSafePermission);
    }

    // Lazily create the (empty) configuration row so future writes have
    // somewhere to land, but there is nothing to return yet.
    await this.prisma.eRPConfiguration.upsert({
      where: { erpConnectionId: connection.id },
      update: {},
      create: { erpConnectionId: connection.id },
    });

    return [];
  }

  async updatePermissions(
    organizationId: string,
    userId: string,
    dto: UpdateErpPermissionsDto,
    meta: RequestMeta,
  ): Promise<SafeErpPermission[]> {
    const existing = await this.getConnectionOrThrow(organizationId);

    const configuration = await this.prisma.eRPConfiguration.upsert({
      where: { erpConnectionId: existing.id },
      update: {},
      create: { erpConnectionId: existing.id },
    });

    const permissions = await this.prisma.$transaction(async (tx) => {
      await tx.eRPPermission.deleteMany({ where: { erpConfigurationId: configuration.id } });

      if (dto.permissions.length === 0) {
        return [];
      }

      await tx.eRPPermission.createMany({
        data: dto.permissions.map((permission) => ({
          erpConfigurationId: configuration.id,
          resource: permission.resource,
          canRead: permission.canRead,
          canWrite: permission.canWrite,
        })),
      });

      return tx.eRPPermission.findMany({ where: { erpConfigurationId: configuration.id } });
    });

    await this.auditService.record({
      action: "ERP_CONFIGURATION_UPDATED",
      userId,
      organizationId,
      metadata: {
        erpConfigurationId: configuration.id,
        resources: dto.permissions.map((p) => p.resource),
      },
      ...meta,
    });

    return permissions.map(toSafePermission);
  }

  private async getConnectionOrThrow(organizationId: string) {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
      include: { erpConnection: true },
    });

    if (!integration?.erpConnection) {
      throw new NotFoundException("No ERP connection configured for this organization");
    }

    return integration.erpConnection;
  }
}
