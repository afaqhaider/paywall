import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { DisputesService } from "./disputes.service";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/disputes")
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.disputesService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":disputeId")
  async getOne(
    @Param("disputeId") disputeId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.disputesService.getOne(disputeId, organizationId);
  }
}
