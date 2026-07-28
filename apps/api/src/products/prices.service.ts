import { Injectable, NotFoundException } from "@nestjs/common";
import { PriceStatus, type Price } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { CreatePriceDto } from "./dto/create-price.dto";
import type { UpdatePriceDto } from "./dto/update-price.dto";

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(planId: string, userId: string, dto: CreatePriceDto, meta: RequestMeta) {
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId },
      include: { product: true },
    });

    const price = await this.prisma.price.create({
      data: {
        planId,
        currency: dto.currency.toUpperCase(),
        amountMinor: dto.amountMinor,
        interval: dto.interval,
        intervalCount: dto.intervalCount ?? 1,
        taxInclusive: dto.taxInclusive ?? false,
        countryCode: dto.countryCode?.toUpperCase(),
        providerRef: dto.providerRef,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.record({
      action: "PRICE_CREATED",
      userId,
      organizationId: plan.product.organizationId,
      applicationId: plan.product.applicationId,
      metadata: { planId, priceId: price.id },
      ...meta,
    });

    return price;
  }

  async list(planId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.price.findMany({
      where: cursorWhere ? { planId, ...cursorWhere } : { planId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(priceId: string): Promise<Price> {
    return this.getOwned(priceId);
  }

  async update(priceId: string, userId: string, dto: UpdatePriceDto, meta: RequestMeta) {
    const existing = await this.getOwned(priceId);

    const price = await this.prisma.price.update({
      where: { id: priceId },
      data: {
        status: dto.status,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.recordAudit("PRICE_UPDATED", existing.planId, userId, priceId, meta);

    return price;
  }

  async archive(priceId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOwned(priceId);

    const price = await this.prisma.price.update({
      where: { id: priceId },
      data: { status: PriceStatus.ARCHIVED },
    });

    await this.recordAudit("PRICE_ARCHIVED", existing.planId, userId, priceId, meta);

    return price;
  }

  private async getOwned(priceId: string): Promise<Price> {
    const price = await this.prisma.price.findUnique({ where: { id: priceId } });
    if (!price) {
      throw new NotFoundException("Price not found");
    }
    return price;
  }

  private async recordAudit(
    action: "PRICE_UPDATED" | "PRICE_ARCHIVED",
    planId: string,
    userId: string,
    priceId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId },
      include: { product: true },
    });
    await this.auditService.record({
      action,
      userId,
      organizationId: plan.product.organizationId,
      applicationId: plan.product.applicationId,
      metadata: { planId, priceId },
      ...meta,
    });
  }
}
