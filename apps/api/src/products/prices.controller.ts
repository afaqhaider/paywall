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
import { PricesService } from "./prices.service";
import { CreatePriceDto } from "./dto/create-price.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(
  OrgScopedGuard("planId", (p: PrismaService, id: string) =>
    p.plan
      .findUnique({ where: { id }, include: { product: true } })
      .then((r) => r?.product.organizationId ?? null),
  ),
)
@Controller("plans/:planId/prices")
export class PlanPricesController {
  constructor(private readonly pricesService: PricesService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("planId") planId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceDto,
    @Req() req: Request,
  ) {
    return this.pricesService.create(planId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("planId") planId: string, @Query() query: CursorQueryDto) {
    return this.pricesService.list(planId, query);
  }
}

@UseGuards(
  OrgScopedGuard("priceId", (p: PrismaService, id: string) =>
    p.price
      .findUnique({ where: { id }, include: { plan: { include: { product: true } } } })
      .then((r) => r?.plan.product.organizationId ?? null),
  ),
)
@Controller("prices/:priceId")
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async getOne(@Param("priceId") priceId: string) {
    return this.pricesService.getOne(priceId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch()
  async update(
    @Param("priceId") priceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePriceDto,
    @Req() req: Request,
  ) {
    return this.pricesService.update(priceId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("priceId") priceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.pricesService.archive(priceId, user.id, extractRequestMeta(req));
  }
}
