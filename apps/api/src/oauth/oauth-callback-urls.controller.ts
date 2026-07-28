import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { OAuthCallbackUrlsService } from "./oauth-callback-urls.service";
import { CreateCallbackUrlDto } from "./dto/create-callback-url.dto";
import { resolveOAuthApplication } from "./resolve-oauth-application.util";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationScopedGuard } from "../common/guards/application-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationScopedGuard("oauthApplicationId", resolveOAuthApplication))
@Controller("oauth-applications/:oauthApplicationId/callback-urls")
export class OAuthCallbackUrlsController {
  constructor(private readonly oauthCallbackUrlsService: OAuthCallbackUrlsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCallbackUrlDto,
    @Req() req: Request,
  ) {
    return this.oauthCallbackUrlsService.create(
      oauthApplicationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Delete(":callbackUrlId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @Param("callbackUrlId") callbackUrlId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.oauthCallbackUrlsService.remove(
      oauthApplicationId,
      callbackUrlId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
