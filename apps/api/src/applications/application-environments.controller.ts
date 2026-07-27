import { Body, Controller, Get, Param, ParseEnumPipe, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ApplicationEnvironmentType, ApplicationMemberRole } from "@prisma/client";
import { ApplicationEnvironmentsService } from "./application-environments.service";
import { UpsertApplicationEnvironmentDto } from "./dto/upsert-application-environment.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/environments")
export class ApplicationEnvironmentsController {
  constructor(private readonly environmentsService: ApplicationEnvironmentsService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.environmentsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Put(":type")
  async upsert(
    @Param("applicationId") applicationId: string,
    @Param("type", new ParseEnumPipe(ApplicationEnvironmentType)) type: ApplicationEnvironmentType,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertApplicationEnvironmentDto,
    @Req() req: Request,
  ) {
    return this.environmentsService.upsert(
      applicationId,
      type,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
