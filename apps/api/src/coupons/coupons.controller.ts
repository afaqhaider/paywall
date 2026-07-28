import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { CouponsService } from "./coupons.service";
import { PromotionCodesService } from "./promotion-codes.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";
import { CreatePromotionCodeDto } from "./dto/create-promotion-code.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCouponDto,
    @Req() req: Request,
  ) {
    return this.couponsService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.couponsService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":couponId")
  async getOne(
    @Param("couponId") couponId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.couponsService.getOne(couponId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":couponId")
  async update(
    @Param("couponId") couponId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCouponDto,
    @Req() req: Request,
  ) {
    return this.couponsService.update(
      couponId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":couponId/archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("couponId") couponId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.couponsService.archive(couponId, organizationId, user.id, extractRequestMeta(req));
  }
}

@UseGuards(
  OrgScopedGuard("couponId", (p: PrismaService, id: string) =>
    p.coupon.findUnique({ where: { id } }).then((r) => r?.organizationId ?? null),
  ),
)
@Controller("coupons/:couponId/promotion-codes")
export class PromotionCodesController {
  constructor(private readonly promotionCodesService: PromotionCodesService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("couponId") couponId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionCodeDto,
    @Req() req: Request,
  ) {
    return this.promotionCodesService.create(couponId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("couponId") couponId: string) {
    return this.promotionCodesService.list(couponId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":promotionCodeId/deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param("couponId") couponId: string,
    @Param("promotionCodeId") promotionCodeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.promotionCodesService.deactivate(
      couponId,
      promotionCodeId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
