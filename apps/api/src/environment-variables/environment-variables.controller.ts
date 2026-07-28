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
import { EnvironmentVariablesService } from "./environment-variables.service";
import { UpsertEnvironmentVariableDto } from "./dto/upsert-environment-variable.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/environments/:environmentId/variables")
export class EnvironmentVariablesController {
  constructor(private readonly environmentVariablesService: EnvironmentVariablesService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(
    @Param("applicationId") applicationId: string,
    @Param("environmentId") environmentId: string,
  ) {
    return this.environmentVariablesService.list(applicationId, environmentId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Put(":key")
  async upsert(
    @Param("applicationId") applicationId: string,
    @Param("environmentId") environmentId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEnvironmentVariableDto,
    @Req() req: Request,
  ) {
    return this.environmentVariablesService.upsert(
      applicationId,
      environmentId,
      key,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Delete(":key")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("environmentId") environmentId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.environmentVariablesService.remove(
      applicationId,
      environmentId,
      key,
      user.id,
      extractRequestMeta(req),
    );
  }
}
