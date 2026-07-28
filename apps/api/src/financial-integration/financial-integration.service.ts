import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpdateFinancialIntegrationDto } from "./dto/update-financial-integration.dto";
import { toSafeConnection, type SafeErpConnection } from "./financial-integration.serializers";

export interface FinancialIntegrationView {
  organizationId: string;
  provider: string;
  erpConnection: SafeErpConnection | null;
}

const ERP_CONNECTION_INCLUDE = {
  erpConnection: {
    include: {
      company: true,
      configuration: { include: { permissions: true } },
    },
  },
} as const;

@Injectable()
export class FinancialIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get-or-implicit-default: if no `FinancialIntegration` row exists yet for
   * this org, return the INTERNAL default shape WITHOUT creating a row - a
   * read must never write.
   */
  async getOrDefault(organizationId: string): Promise<FinancialIntegrationView> {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
      include: ERP_CONNECTION_INCLUDE,
    });

    if (!integration) {
      return { organizationId, provider: "INTERNAL", erpConnection: null };
    }

    return {
      organizationId: integration.organizationId,
      provider: integration.provider,
      erpConnection: integration.erpConnection ? toSafeConnection(integration.erpConnection) : null,
    };
  }

  async upsertProvider(
    organizationId: string,
    userId: string,
    dto: UpdateFinancialIntegrationDto,
    meta: RequestMeta,
  ): Promise<FinancialIntegrationView> {
    await this.prisma.financialIntegration.upsert({
      where: { organizationId },
      update: { provider: dto.provider },
      create: { organizationId, provider: dto.provider, createdById: userId },
    });

    await this.auditService.record({
      action: "FINANCIAL_INTEGRATION_UPDATED",
      userId,
      organizationId,
      metadata: { provider: dto.provider },
      ...meta,
    });

    return this.getOrDefault(organizationId);
  }
}
