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
import { ApplicationMemberRole, OrganizationRole } from "@prisma/client";
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { ListApplicationsQueryDto } from "./dto/list-applications-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard, ApplicationRoleGuard)
@Controller("organizations/:organizationId/applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
    @Req() req: Request,
  ) {
    return this.applicationsService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ) {
    return this.applicationsService.listForOrganization(organizationId, user.id, query);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":applicationId")
  async getOne(@Param("applicationId") applicationId: string) {
    return this.applicationsService.getOne(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Patch(":applicationId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDto,
    @Req() req: Request,
  ) {
    return this.applicationsService.update(
      applicationId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post(":applicationId/archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("applicationId") applicationId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applicationsService.archive(
      applicationId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post(":applicationId/restore")
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("applicationId") applicationId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.applicationsService.restore(
      applicationId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.OWNER)
  @Delete(":applicationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.applicationsService.remove(
      applicationId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Get(":applicationId/audit-logs")
  async listAuditLogs(@Param("applicationId") applicationId: string) {
    return this.applicationsService.listAuditLogs(applicationId);
  }
}
