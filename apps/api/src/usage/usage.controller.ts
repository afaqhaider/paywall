import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { UsageService } from "./usage.service";
import { CreateUsageRecordDto } from "./dto/create-usage-record.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/usage-records")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Post()
  async record(@Param("organizationId") organizationId: string, @Body() dto: CreateUsageRecordDto) {
    return this.usageService.record(organizationId, dto);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.usageService.list(organizationId, query);
  }
}
