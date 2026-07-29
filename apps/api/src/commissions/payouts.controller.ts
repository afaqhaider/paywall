import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PayoutsService } from "./payouts.service";
import { CreatePayoutDto } from "./dto/create-payout.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/payouts")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get("accrued")
  async listAccrued() {
    return this.payoutsService.listAccrued();
  }

  @Get("organizations/:organizationId")
  async listForOrganization(@Param("organizationId") organizationId: string) {
    return this.payoutsService.listForOrganization(organizationId);
  }

  @Post()
  async create(
    @Body() dto: CreatePayoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.payoutsService.createForOrganization(
      dto.organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @Post(":payoutId/mark-paid")
  async markPaid(
    @Param("payoutId") payoutId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.payoutsService.markPaid(payoutId, user.id, extractRequestMeta(req));
  }
}
