import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { FinancialIntegrationService } from "./financial-integration.service";
import { UpdateFinancialIntegrationDto } from "./dto/update-financial-integration.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/financial-integration")
export class FinancialIntegrationController {
  constructor(private readonly financialIntegrationService: FinancialIntegrationService) {}

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get()
  async getOne(@Param("organizationId") organizationId: string) {
    return this.financialIntegrationService.getOrDefault(organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Put()
  async update(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFinancialIntegrationDto,
    @Req() req: Request,
  ) {
    return this.financialIntegrationService.upsertProvider(
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
