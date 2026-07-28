import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminApplicationsService } from "./admin-applications.service";
import { AdminApplicationQueryDto } from "./dto/admin-application-query.dto";
import { MoveApplicationDto } from "./dto/move-application.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/applications")
export class AdminApplicationsController {
  constructor(private readonly adminApplicationsService: AdminApplicationsService) {}

  @Get()
  async list(@Query() query: AdminApplicationQueryDto) {
    return this.adminApplicationsService.list(query);
  }

  @Get(":applicationId")
  async getOne(@Param("applicationId") applicationId: string) {
    return this.adminApplicationsService.getOne(applicationId);
  }

  @Post(":applicationId/suspend")
  async suspend(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminApplicationsService.suspend(applicationId, user.id, extractRequestMeta(req));
  }

  @Post(":applicationId/restore")
  async restore(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminApplicationsService.restore(applicationId, user.id, extractRequestMeta(req));
  }

  @Post(":applicationId/archive")
  async archive(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminApplicationsService.archive(applicationId, user.id, extractRequestMeta(req));
  }

  @Post(":applicationId/move")
  async move(
    @Param("applicationId") applicationId: string,
    @Body() dto: MoveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminApplicationsService.move(applicationId, dto, user.id, extractRequestMeta(req));
  }
}
