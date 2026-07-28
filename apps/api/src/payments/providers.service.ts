import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentProviderStatus, type PaymentProvider, type ProviderAccount } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateProviderDto } from "./dto/create-provider.dto";
import type { UpdateProviderDto } from "./dto/update-provider.dto";
import type { CreateProviderAccountDto } from "./dto/create-provider-account.dto";

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateProviderDto, meta: RequestMeta) {
    const provider = await this.prisma.paymentProvider.create({
      data: {
        organizationId,
        type: dto.type,
        displayName: dto.displayName,
        environment: dto.environment,
        config: dto.config,
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "PAYMENT_PROVIDER_CREATED",
      userId,
      organizationId,
      metadata: { providerId: provider.id, type: provider.type },
      ...meta,
    });

    return provider;
  }

  async list(organizationId: string) {
    return this.prisma.paymentProvider.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(providerId: string, organizationId: string): Promise<PaymentProvider> {
    return this.getOwned(providerId, organizationId);
  }

  async update(
    providerId: string,
    organizationId: string,
    userId: string,
    dto: UpdateProviderDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(providerId, organizationId);

    const provider = await this.prisma.paymentProvider.update({
      where: { id: providerId },
      data: { displayName: dto.displayName, status: dto.status, config: dto.config },
    });

    await this.auditService.record({
      action: "PAYMENT_PROVIDER_UPDATED",
      userId,
      organizationId,
      metadata: { providerId },
      ...meta,
    });

    return provider;
  }

  async archive(providerId: string, organizationId: string, userId: string, meta: RequestMeta) {
    await this.getOwned(providerId, organizationId);

    const provider = await this.prisma.paymentProvider.update({
      where: { id: providerId },
      data: { status: PaymentProviderStatus.DISABLED, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "PAYMENT_PROVIDER_ARCHIVED",
      userId,
      organizationId,
      metadata: { providerId },
      ...meta,
    });

    return provider;
  }

  async createAccount(providerId: string, dto: CreateProviderAccountDto): Promise<ProviderAccount> {
    return this.prisma.providerAccount.create({
      data: {
        providerId,
        externalAccountId: dto.externalAccountId,
        label: dto.label,
        metadata: dto.metadata,
      },
    });
  }

  async listAccounts(providerId: string): Promise<ProviderAccount[]> {
    return this.prisma.providerAccount.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOwned(providerId: string, organizationId: string): Promise<PaymentProvider> {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id: providerId } });
    if (!provider || provider.organizationId !== organizationId) {
      throw new NotFoundException("Payment provider not found");
    }
    return provider;
  }
}
