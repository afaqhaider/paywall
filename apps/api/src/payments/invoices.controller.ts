import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { InvoicesService } from "./invoices.service";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.invoicesService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":invoiceId")
  async getOne(
    @Param("invoiceId") invoiceId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.invoicesService.getOne(invoiceId, organizationId);
  }
}
