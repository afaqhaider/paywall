import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CouponStatus, type Coupon } from "@prisma/client";
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
import type { CreateCouponDto } from "./dto/create-coupon.dto";
import type { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateCouponDto, meta: RequestMeta) {
    const coupon = await this.prisma.coupon.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        discountType: dto.discountType,
        amountOffMinor: dto.amountOffMinor,
        percentOff: dto.percentOff,
        currency: dto.currency?.toUpperCase(),
        duration: dto.duration,
        durationInCycles: dto.durationInCycles,
        maxRedemptions: dto.maxRedemptions,
        productId: dto.productId,
        planId: dto.planId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "COUPON_CREATED",
      userId,
      organizationId,
      metadata: { couponId: coupon.id, code: coupon.code },
      ...meta,
    });

    return coupon;
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.coupon.findMany({
      where: cursorWhere ? { organizationId, ...cursorWhere } : { organizationId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(couponId: string, organizationId: string): Promise<Coupon> {
    return this.getOwned(couponId, organizationId);
  }

  async update(
    couponId: string,
    organizationId: string,
    userId: string,
    dto: UpdateCouponDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(couponId, organizationId);

    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        status: dto.status,
        maxRedemptions: dto.maxRedemptions,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.record({
      action: "COUPON_UPDATED",
      userId,
      organizationId,
      metadata: { couponId },
      ...meta,
    });

    return coupon;
  }

  async archive(couponId: string, organizationId: string, userId: string, meta: RequestMeta) {
    await this.getOwned(couponId, organizationId);

    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: { status: CouponStatus.ARCHIVED },
    });

    await this.auditService.record({
      action: "COUPON_ARCHIVED",
      userId,
      organizationId,
      metadata: { couponId },
      ...meta,
    });

    return coupon;
  }

  /** Validates a coupon (direct or via promotion code) against eligibility rules. Does not mutate state. */
  async resolveForRedemption(
    organizationId: string,
    input: { couponId?: string; promotionCode?: string },
    subscription: { productId: string; planId: string; customerId: string },
  ) {
    let coupon: Coupon;
    let promotionCode: {
      id: string;
      maxRedemptions: number | null;
      redemptionCount: number;
      customerId: string | null;
    } | null = null;

    if (input.promotionCode) {
      const found = await this.prisma.promotionCode.findUnique({
        where: { code: input.promotionCode },
        include: { coupon: true },
      });
      if (!found || found.coupon.organizationId !== organizationId) {
        throw new NotFoundException("Promotion code not found");
      }
      if (!found.active || (found.expiresAt && found.expiresAt < new Date())) {
        throw new BadRequestException("Promotion code is no longer valid");
      }
      if (found.maxRedemptions !== null && found.redemptionCount >= found.maxRedemptions) {
        throw new BadRequestException("Promotion code has reached its redemption limit");
      }
      if (found.customerId && found.customerId !== subscription.customerId) {
        throw new BadRequestException("Promotion code is not valid for this customer");
      }
      coupon = found.coupon;
      promotionCode = found;
    } else if (input.couponId) {
      coupon = await this.getOwned(input.couponId, organizationId);
    } else {
      throw new BadRequestException("Either couponId or promotionCode is required");
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException("Coupon is not active");
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException("Coupon has expired");
    }
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException("Coupon has reached its redemption limit");
    }
    if (coupon.productId && coupon.productId !== subscription.productId) {
      throw new BadRequestException("Coupon does not apply to this product");
    }
    if (coupon.planId && coupon.planId !== subscription.planId) {
      throw new BadRequestException("Coupon does not apply to this plan");
    }

    return { coupon, promotionCode };
  }

  private async getOwned(couponId: string, organizationId: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || coupon.organizationId !== organizationId) {
      throw new NotFoundException("Coupon not found");
    }
    return coupon;
  }
}
