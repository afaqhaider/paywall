import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminSupportService } from "./admin-support.service";
import { ImpersonateDto } from "./dto/impersonate.dto";
import { LoginLinkDto } from "./dto/login-link.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/support")
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  @Post("users/:userId/impersonate")
  async impersonate(
    @Param("userId") userId: string,
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminSupportService.impersonate(userId, user.id, dto, extractRequestMeta(req));
  }

  @Post("impersonate/:token/redeem")
  async redeem(@Param("token") token: string, @Req() req: Request) {
    return this.adminSupportService.redeem(token, extractRequestMeta(req));
  }

  @Post("users/:userId/login-link")
  async loginLink(
    @Param("userId") userId: string,
    @Body() dto: LoginLinkDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminSupportService.createLoginLink(userId, user.id, dto, extractRequestMeta(req));
  }

  @Get("impersonation-history")
  async impersonationHistory(@Query() query: CursorQueryDto) {
    return this.adminSupportService.listImpersonationHistory(query);
  }

  @Post("users/:userId/unlock")
  async unlock(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.adminSupportService.unlockUser(userId, user.id, extractRequestMeta(req));
  }

  @Post("users/:userId/reset-password")
  async resetPassword(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminSupportService.resetPassword(userId, user.id, extractRequestMeta(req));
  }

  @Post("users/:userId/reset-2fa")
  async reset2fa(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.adminSupportService.reset2fa(userId, user.id, extractRequestMeta(req));
  }

  @Post("users/:userId/invalidate-sessions")
  async invalidateSessions(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminSupportService.invalidateSessions(userId, user.id, extractRequestMeta(req));
  }
}
