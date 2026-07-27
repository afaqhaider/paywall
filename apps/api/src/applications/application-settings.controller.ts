import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { ApplicationSettingsService } from "./application-settings.service";
import { UpsertApplicationSettingDto } from "./dto/upsert-application-setting.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/settings")
export class ApplicationSettingsController {
  constructor(private readonly settingsService: ApplicationSettingsService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.settingsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Put(":key")
  async upsert(
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertApplicationSettingDto,
    @Req() req: Request,
  ) {
    return this.settingsService.upsert(
      applicationId,
      key,
      dto.value,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":key")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.settingsService.remove(applicationId, key, user.id, extractRequestMeta(req));
  }
}
