import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ReportFormat, ReportStatus, ReportType, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BackgroundJobsService } from "../background-jobs/background-jobs.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { ListReportRequestsQueryDto } from "./dto/list-report-requests-query.dto";

export const REPORT_GENERATION_JOB_TYPE = "REPORT_GENERATION";

/** Fields safe to return over the wire - never includes the raw `resultData` bytes. */
const REPORT_METADATA_SELECT = {
  id: true,
  type: true,
  format: true,
  status: true,
  filters: true,
  organizationId: true,
  requestedById: true,
  filename: true,
  mimeType: true,
  error: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.ReportRequestSelect;

/**
 * Request/list/inspect half of the Reports feature. Generation itself
 * happens asynchronously via a `REPORT_GENERATION` background job, handled
 * by `ReportGenerationProcessorService` - this service only enqueues it and
 * reads back the resulting `ReportRequest` row, exactly like every other
 * Phase 10 feature built on `BackgroundJobsService`/`JobProcessorRegistryService`.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobs: BackgroundJobsService,
    private readonly auditService: AuditService,
  ) {}

  async requestReport(
    type: ReportType,
    format: ReportFormat,
    organizationId: string | null,
    filters: Record<string, unknown> | undefined,
    requestedById: string,
    meta: RequestMeta = {},
  ) {
    const reportRequest = await this.prisma.reportRequest.create({
      data: {
        type,
        format,
        status: ReportStatus.PENDING,
        filters: filters as Prisma.InputJsonValue | undefined,
        organizationId: organizationId ?? undefined,
        requestedById,
      },
    });

    await this.backgroundJobs.enqueue(REPORT_GENERATION_JOB_TYPE, {
      reportRequestId: reportRequest.id,
    });

    await this.auditService.record({
      action: "REPORT_REQUESTED",
      userId: requestedById,
      organizationId: organizationId ?? undefined,
      metadata: { reportRequestId: reportRequest.id, type, format },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return reportRequest;
  }

  async list(query: ListReportRequestsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.ReportRequestWhereInput = {
      type: query.type,
      format: query.format,
      status: query.status,
      organizationId: query.organizationId,
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.reportRequest.findMany({
      where,
      select: REPORT_METADATA_SELECT,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(id: string) {
    const report = await this.prisma.reportRequest.findUnique({
      where: { id },
      select: REPORT_METADATA_SELECT,
    });
    if (!report) {
      throw new NotFoundException("Report request not found");
    }
    return report;
  }

  /** Only used by the download endpoint - includes `resultData`, never serialized directly to JSON. */
  async getForDownload(id: string) {
    const report = await this.prisma.reportRequest.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException("Report request not found");
    }
    if (report.status !== ReportStatus.SUCCESS || !report.resultData) {
      throw new BadRequestException(`Report is not ready for download (status: ${report.status})`);
    }
    return report;
  }
}
