import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { UsageLimitsService } from "./usage-limits.service";
import { UpsertUsageLimitDto } from "./dto/upsert-usage-limit.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/applications/:applicationId/usage-limits")
export class UsageLimitsController {
  constructor(private readonly usageLimitsService: UsageLimitsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Put(":key")
  async upsert(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertUsageLimitDto,
    @Req() req: Request,
  ) {
    return this.usageLimitsService.upsertLimit(
      organizationId,
      applicationId,
      key,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
  ) {
    return this.usageLimitsService.list(organizationId, applicationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":key")
  async getOne(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
  ) {
    return this.usageLimitsService.getOne(organizationId, applicationId, key);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":key/reset")
  async reset(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usageLimitsService.resetCounter(
      organizationId,
      applicationId,
      key,
      user.id,
      extractRequestMeta(req),
    );
  }
}
