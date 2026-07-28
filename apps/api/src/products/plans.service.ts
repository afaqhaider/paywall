import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PlanStatus, type Plan } from "@prisma/client";
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
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(productId: string, userId: string, dto: CreatePlanDto, meta: RequestMeta) {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });

    const existing = await this.prisma.plan.findUnique({
      where: { productId_code: { productId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException("A plan with this code already exists for this product");
    }

    const plan = await this.prisma.plan.create({
      data: {
        productId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        billingType: dto.billingType,
        trialEligible: dto.trialEligible ?? false,
        trialDays: dto.trialDays,
        seatLimit: dto.seatLimit,
        sortOrder: dto.sortOrder ?? 0,
        metadata: dto.metadata,
      },
    });

    await this.auditService.record({
      action: "PLAN_CREATED",
      userId,
      organizationId: product.organizationId,
      applicationId: product.applicationId,
      metadata: { productId, planId: plan.id },
      ...meta,
    });

    return plan;
  }

  async list(productId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.plan.findMany({
      where: cursorWhere ? { productId, ...cursorWhere } : { productId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(planId: string): Promise<Plan> {
    return this.getOwned(planId);
  }

  async update(planId: string, userId: string, dto: UpdatePlanDto, meta: RequestMeta) {
    const existing = await this.getOwned(planId);

    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { ...dto },
    });

    await this.recordAudit("PLAN_UPDATED", existing.productId, userId, planId, meta);

    return plan;
  }

  async archive(planId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOwned(planId);

    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { status: PlanStatus.ARCHIVED, archivedAt: new Date() },
    });

    await this.recordAudit("PLAN_ARCHIVED", existing.productId, userId, planId, meta);

    return plan;
  }

  async restore(planId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOwned(planId);

    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { status: PlanStatus.DRAFT, archivedAt: null },
    });

    await this.recordAudit("PLAN_RESTORED", existing.productId, userId, planId, meta);

    return plan;
  }

  private async getOwned(planId: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    return plan;
  }

  private async recordAudit(
    action: "PLAN_UPDATED" | "PLAN_ARCHIVED" | "PLAN_RESTORED",
    productId: string,
    userId: string,
    planId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    await this.auditService.record({
      action,
      userId,
      organizationId: product.organizationId,
      applicationId: product.applicationId,
      metadata: { productId, planId },
      ...meta,
    });
  }
}
