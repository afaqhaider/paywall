import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminCustomersService } from "./admin-customers.service";
import { AdminCustomerQueryDto } from "./dto/admin-customer-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/customers")
export class AdminCustomersController {
  constructor(private readonly adminCustomersService: AdminCustomersService) {}

  @Get()
  async list(@Query() query: AdminCustomerQueryDto) {
    return this.adminCustomersService.list(query);
  }

  @Get(":customerId")
  async getOne(@Param("customerId") customerId: string) {
    return this.adminCustomersService.getOne(customerId);
  }

  @Post(":customerId/suspend")
  async suspend(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminCustomersService.suspend(customerId, user.id, extractRequestMeta(req));
  }

  @Post(":customerId/reactivate")
  async reactivate(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminCustomersService.reactivate(customerId, user.id, extractRequestMeta(req));
  }
}
