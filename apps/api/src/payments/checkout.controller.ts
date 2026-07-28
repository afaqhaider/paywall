import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { CheckoutService } from "./checkout.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/checkout-sessions")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: Request,
  ) {
    return this.checkoutService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.checkoutService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":checkoutSessionId")
  async getOne(
    @Param("checkoutSessionId") checkoutSessionId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.checkoutService.getOne(checkoutSessionId, organizationId);
  }
}
