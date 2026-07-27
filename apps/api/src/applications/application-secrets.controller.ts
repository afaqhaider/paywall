import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ApplicationSecretsService } from "./application-secrets.service";
import { CreateApplicationSecretDto } from "./dto/create-application-secret.dto";
import { RotateApplicationSecretDto } from "./dto/rotate-application-secret.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/secrets")
export class ApplicationSecretsController {
  constructor(private readonly secretsService: ApplicationSecretsService) {}

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationSecretDto,
    @Req() req: Request,
  ) {
    return this.secretsService.create(applicationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.secretsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Patch(":secretId")
  async rotate(
    @Param("applicationId") applicationId: string,
    @Param("secretId") secretId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RotateApplicationSecretDto,
    @Req() req: Request,
  ) {
    return this.secretsService.rotate(
      applicationId,
      secretId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":secretId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("secretId") secretId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.secretsService.remove(applicationId, secretId, user.id, extractRequestMeta(req));
  }
}
