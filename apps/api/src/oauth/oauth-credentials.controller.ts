import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { OAuthCredentialsService } from "./oauth-credentials.service";
import { resolveOAuthApplication } from "./resolve-oauth-application.util";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationScopedGuard } from "../common/guards/application-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationScopedGuard("oauthApplicationId", resolveOAuthApplication))
@Controller("oauth-applications/:oauthApplicationId/credentials")
export class OAuthCredentialsController {
  constructor(private readonly oauthCredentialsService: OAuthCredentialsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.oauthCredentialsService.create(
      oauthApplicationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Patch(":credentialId/rotate")
  async rotate(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @Param("credentialId") credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.oauthCredentialsService.rotate(
      oauthApplicationId,
      credentialId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":credentialId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param("oauthApplicationId") oauthApplicationId: string,
    @Param("credentialId") credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.oauthCredentialsService.revoke(
      oauthApplicationId,
      credentialId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
