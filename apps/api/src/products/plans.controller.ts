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
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(
  OrgScopedGuard("productId", (p: PrismaService, id: string) =>
    p.product.findUnique({ where: { id } }).then((r) => r?.organizationId ?? null),
  ),
)
@Controller("products/:productId/plans")
export class ProductPlansController {
  constructor(private readonly plansService: PlansService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("productId") productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlanDto,
    @Req() req: Request,
  ) {
    return this.plansService.create(productId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("productId") productId: string, @Query() query: CursorQueryDto) {
    return this.plansService.list(productId, query);
  }
}

@UseGuards(
  OrgScopedGuard("planId", (p: PrismaService, id: string) =>
    p.plan
      .findUnique({ where: { id }, include: { product: true } })
      .then((r) => r?.product.organizationId ?? null),
  ),
)
@Controller("plans/:planId")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async getOne(@Param("planId") planId: string) {
    return this.plansService.getOne(planId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch()
  async update(
    @Param("planId") planId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlanDto,
    @Req() req: Request,
  ) {
    return this.plansService.update(planId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("planId") planId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.plansService.archive(planId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("restore")
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("planId") planId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.plansService.restore(planId, user.id, extractRequestMeta(req));
  }
}
