import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminFinancialService } from "./admin-financial.service";
import { ListAdminFinancialEventsQueryDto } from "./dto/list-admin-financial-events-query.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/** Cross-organization admin view of Phase 8's financial integration/sync
 * pipeline (the Phase 8 `financial-events`/`financial-sync` controllers are
 * org-scoped only). */
@UseGuards(PlatformAdminGuard)
@Controller("admin/financial")
export class AdminFinancialController {
  constructor(private readonly adminFinancialService: AdminFinancialService) {}

  @Get("integrations")
  async listIntegrations(@Query() query: CursorQueryDto) {
    return this.adminFinancialService.listIntegrations(query);
  }

  @Get("sync/pending")
  async listPendingSyncs(@Query() query: CursorQueryDto) {
    return this.adminFinancialService.listPendingSyncs(query);
  }

  @Get("sync/dead-letter")
  async listDeadLetter(@Query() query: CursorQueryDto) {
    return this.adminFinancialService.listDeadLetter(query);
  }

  @Get("sync/failed-transactions")
  async listFailedTransactions(@Query() query: CursorQueryDto) {
    return this.adminFinancialService.listFailedTransactions(query);
  }

  @Get("events")
  async listEvents(@Query() query: ListAdminFinancialEventsQueryDto) {
    return this.adminFinancialService.listEvents(query);
  }

  @Post("sync/:financialSyncId/retry")
  async retry(
    @Param("financialSyncId") financialSyncId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminFinancialService.retry(financialSyncId, admin.id, extractRequestMeta(req));
  }
}
