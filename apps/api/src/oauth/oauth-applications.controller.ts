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
import { ApplicationMemberRole } from "@prisma/client";
import { OAuthApplicationsService } from "./oauth-applications.service";
import { CreateOAuthApplicationDto } from "./dto/create-oauth-application.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/oauth-applications")
export class OAuthApplicationsController {
  constructor(private readonly oauthApplicationsService: OAuthApplicationsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOAuthApplicationDto,
    @Req() req: Request,
  ) {
    return this.oauthApplicationsService.create(
      applicationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.oauthApplicationsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":oauthApplicationId")
  async getOne(
    @Param("applicationId") applicationId: string,
    @Param("oauthApplicationId") oauthApplicationId: string,
  ) {
    return this.oauthApplicationsService.getOne(applicationId, oauthApplicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":oauthApplicationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("oauthApplicationId") oauthApplicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.oauthApplicationsService.remove(
      applicationId,
      oauthApplicationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
