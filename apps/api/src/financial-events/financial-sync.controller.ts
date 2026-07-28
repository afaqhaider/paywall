import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { FinancialSyncService } from "./financial-sync.service";
import { ListFinancialSyncQueryDto } from "./dto/list-financial-sync-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/** Org-staff sync-status/history/retry surface - not a customer-facing read
 * endpoint. The Customer Portal reads invoice/receipt/transaction views
 * directly from Prisma instead of calling these. */
@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/financial-sync")
export class FinancialSyncController {
  constructor(private readonly financialSyncService: FinancialSyncService) {}

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get("status")
  async getStatus(@Param("organizationId") organizationId: string) {
    return this.financialSyncService.getStatus(organizationId);
  }

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get("history")
  async listHistory(
    @Param("organizationId") organizationId: string,
    @Query() query: ListFinancialSyncQueryDto,
  ) {
    return this.financialSyncService.listHistory(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get("history/:financialSyncId")
  async getHistoryDetail(
    @Param("organizationId") organizationId: string,
    @Param("financialSyncId") financialSyncId: string,
  ) {
    return this.financialSyncService.getHistoryDetail(organizationId, financialSyncId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("history/:financialSyncId/retry")
  async retry(
    @Param("organizationId") organizationId: string,
    @Param("financialSyncId") financialSyncId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.financialSyncService.retry(
      organizationId,
      financialSyncId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
