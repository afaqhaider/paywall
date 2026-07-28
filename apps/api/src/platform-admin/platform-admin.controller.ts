import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { PlatformAdminService } from "./platform-admin.service";
import { GrantPlatformAdminDto } from "./dto/grant-platform-admin.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * The very first `PlatformAdmin` row cannot be created here (this whole
 * controller is behind `PlatformAdminGuard`, which requires one to already
 * exist) - that bootstrap step is `apps/api/scripts/grant-super-admin.ts`,
 * run manually once. Every grant/revoke after that goes through this
 * audited HTTP surface.
 */
@UseGuards(PlatformAdminGuard)
@Controller("admin/platform-admins")
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Post()
  async grant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GrantPlatformAdminDto,
    @Req() req: Request,
  ) {
    return this.platformAdminService.grant(user.id, dto, extractRequestMeta(req));
  }

  @Get()
  async list() {
    return this.platformAdminService.list();
  }

  @Delete(":platformAdminId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param("platformAdminId") platformAdminId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.platformAdminService.revoke(platformAdminId, user.id, extractRequestMeta(req));
  }
}
