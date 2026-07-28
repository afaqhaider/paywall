import { Injectable, NotFoundException } from "@nestjs/common";
import type { PromotionCode } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreatePromotionCodeDto } from "./dto/create-promotion-code.dto";

@Injectable()
export class PromotionCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(couponId: string, userId: string, dto: CreatePromotionCodeDto, meta: RequestMeta) {
    const coupon = await this.prisma.coupon.findUniqueOrThrow({ where: { id: couponId } });

    const promotionCode = await this.prisma.promotionCode.create({
      data: {
        couponId,
        code: dto.code,
        maxRedemptions: dto.maxRedemptions,
        customerId: dto.customerId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.record({
      action: "PROMOTION_CODE_CREATED",
      userId,
      organizationId: coupon.organizationId,
      metadata: { couponId, promotionCodeId: promotionCode.id },
      ...meta,
    });

    return promotionCode;
  }

  async list(couponId: string) {
    return this.prisma.promotionCode.findMany({
      where: { couponId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deactivate(couponId: string, promotionCodeId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOwned(couponId, promotionCodeId);

    const promotionCode = await this.prisma.promotionCode.update({
      where: { id: promotionCodeId },
      data: { active: false },
    });

    const coupon = await this.prisma.coupon.findUniqueOrThrow({ where: { id: existing.couponId } });
    await this.auditService.record({
      action: "PROMOTION_CODE_ARCHIVED",
      userId,
      organizationId: coupon.organizationId,
      metadata: { couponId, promotionCodeId },
      ...meta,
    });

    return promotionCode;
  }

  private async getOwned(couponId: string, promotionCodeId: string): Promise<PromotionCode> {
    const promotionCode = await this.prisma.promotionCode.findUnique({
      where: { id: promotionCodeId },
    });
    if (!promotionCode || promotionCode.couponId !== couponId) {
      throw new NotFoundException("Promotion code not found");
    }
    return promotionCode;
  }
}
