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
import { OAuthRedirectUrisService } from "./oauth-redirect-uris.service";
import { CreateRedirectUriDto } from "./dto/create-redirect-uri.dto";
import { resolveOAuthApplication } from "./resolve-oauth-application.util";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationScopedGuard } from "../common/guards/application-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationScopedGuard("oauthApplicationId", resolveOAuthApplication))
@Controller("oauth-applications/:oauthApplicationId/redirect-uris")
export class OAuthRedirectUrisController {
  constructor(private readonly oauthRedirectUrisService: OAuthRedirectUrisService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRedirectUriDto,
    @Req() req: Request,
  ) {
    return this.oauthRedirectUrisService.create(
      oauthApplicationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Delete(":redirectUriId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @Param("redirectUriId") redirectUriId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.oauthRedirectUrisService.remove(
      oauthApplicationId,
      redirectUriId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
