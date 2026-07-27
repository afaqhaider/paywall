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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { ApplicationVersionsService } from "./application-versions.service";
import { CreateApplicationVersionDto } from "./dto/create-application-version.dto";
import { UpdateApplicationVersionDto } from "./dto/update-application-version.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/versions")
export class ApplicationVersionsController {
  constructor(private readonly versionsService: ApplicationVersionsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationVersionDto,
    @Req() req: Request,
  ) {
    return this.versionsService.create(applicationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string, @Query("track") track?: string) {
    return this.versionsService.list(applicationId, track);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":versionId")
  async getOne(
    @Param("applicationId") applicationId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.versionsService.getOne(applicationId, versionId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Patch(":versionId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationVersionDto,
    @Req() req: Request,
  ) {
    return this.versionsService.update(
      applicationId,
      versionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":versionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.versionsService.remove(applicationId, versionId, user.id, extractRequestMeta(req));
  }
}
