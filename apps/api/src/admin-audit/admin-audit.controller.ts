import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AdminAuditService } from "./admin-audit.service";
import { AdminAuditLogQueryDto } from "./dto/admin-audit-query.dto";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/audit-log")
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  async list(@Query() query: AdminAuditLogQueryDto) {
    return this.adminAuditService.list(query);
  }

  @Get("export")
  async export(@Query() query: AdminAuditLogQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.adminAuditService.exportCsv(query);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="audit-log-export.csv"');
    res.send(csv);
  }
}
