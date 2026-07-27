import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { AuditService } from "../audit/audit.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.create(user.id, dto, extractRequestMeta(req));
  }

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.id);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":organizationId")
  async getOne(@Param("organizationId") organizationId: string) {
    return this.organizationsService.getOne(organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":organizationId")
  async update(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.update(organizationId, dto, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.OWNER)
  @Delete(":organizationId")
  async remove(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.organizationsService.remove(organizationId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":organizationId/members")
  async listMembers(@Param("organizationId") organizationId: string) {
    return this.organizationsService.listMembers(organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":organizationId/members")
  async addMember(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddMemberDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.addMember(
      organizationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":organizationId/members/:membershipId")
  async updateMemberRole(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.updateMemberRole(
      organizationId,
      membershipId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":organizationId/members/:membershipId")
  async removeMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.organizationsService.removeMember(
      organizationId,
      membershipId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Get(":organizationId/audit-logs")
  async listAuditLogs(@Param("organizationId") organizationId: string) {
    return this.auditService.listForOrganization(organizationId);
  }
}
