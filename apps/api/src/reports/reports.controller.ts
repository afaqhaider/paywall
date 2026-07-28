import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { ReportsService } from "./reports.service";
import { CreateReportRequestDto } from "./dto/create-report-request.dto";
import { ListReportRequestsQueryDto } from "./dto/list-report-requests-query.dto";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { extractRequestMeta } from "../common/utils/request-meta.util";

/**
 * Platform admin reporting: request/list/inspect/download background-
 * generated reports. Deliberately NOT `admin/reports` - that path is
 * already owned by Phase 9's `AdminReportsModule` (live dashboard-style
 * report views); this is a distinct concept (async `ReportRequest`
 * generation + CSV/Excel/PDF export), so it gets its own path to avoid a
 * route collision.
 */
@UseGuards(PlatformAdminGuard)
@Controller("admin/report-requests")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async requestReport(
    @Body() body: CreateReportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportsService.requestReport(
      body.type,
      body.format,
      body.organizationId ?? null,
      body.filters,
      user.id,
      extractRequestMeta(req),
    );
  }

  @Get()
  async list(@Query() query: ListReportRequestsQueryDto) {
    return this.reportsService.list(query);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.reportsService.getOne(id);
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const report = await this.reportsService.getForDownload(id);
    res.setHeader("Content-Type", report.mimeType ?? "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.filename ?? `report-${report.id}`}"`,
    );
    res.send(report.resultData);
  }
}
