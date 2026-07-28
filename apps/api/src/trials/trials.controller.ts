import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { TrialsService } from "./trials.service";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/trials")
export class TrialsController {
  constructor(private readonly trialsService: TrialsService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.trialsService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":trialId")
  async getOne(@Param("trialId") trialId: string, @Param("organizationId") organizationId: string) {
    return this.trialsService.getOne(trialId, organizationId);
  }
}
