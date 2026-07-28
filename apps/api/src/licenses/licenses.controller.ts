import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { LicensesService } from "./licenses.service";
import { CreateLicenseDto } from "./dto/create-license.dto";
import { UpdateLicenseDto } from "./dto/update-license.dto";
import { AssignLicenseDto } from "./dto/assign-license.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/licenses")
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licensesService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.licensesService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":licenseId")
  async getOne(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.licensesService.getOne(licenseId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":licenseId")
  async update(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLicenseDto,
    @Req() req: Request,
  ) {
    return this.licensesService.update(
      licenseId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":licenseId/revoke")
  async revoke(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.licensesService.revoke(licenseId, organizationId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":licenseId/assignments")
  async listAssignments(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.licensesService.listAssignments(licenseId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":licenseId/assignments")
  async assign(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignLicenseDto,
    @Req() req: Request,
  ) {
    return this.licensesService.assign(
      licenseId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":licenseId/assignments/:userId")
  async unassign(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.licensesService.unassign(
      licenseId,
      organizationId,
      targetUserId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
