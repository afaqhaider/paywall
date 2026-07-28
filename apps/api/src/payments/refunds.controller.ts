import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { RefundsService } from "./refunds.service";
import { CreateRefundDto } from "./dto/create-refund.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId")
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("transactions/:transactionId/refunds")
  async create(
    @Param("transactionId") transactionId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto,
    @Req() req: Request,
  ) {
    return this.refundsService.create(
      transactionId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get("refunds")
  async list(@Param("organizationId") organizationId: string) {
    return this.refundsService.list(organizationId);
  }
}
