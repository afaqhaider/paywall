import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ReportStatus, type BackgroundJob, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobProcessorRegistryService } from "../background-jobs/job-processor-registry.service";
import { REPORT_GENERATION_JOB_TYPE } from "./reports.service";
import { runReportQuery } from "./utils/report-queries.util";
import { renderReport } from "./utils/report-renderer.util";

interface ReportGenerationPayload {
  reportRequestId: string;
  [key: string]: Prisma.JsonValue | undefined;
}

function isReportGenerationPayload(payload: Prisma.JsonValue): payload is ReportGenerationPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    typeof (payload as Record<string, unknown>).reportRequestId === "string"
  );
}

/**
 * Registers the `"REPORT_GENERATION"` processor with the Phase 10
 * background job framework (`JobProcessorRegistryService`). Loads the
 * `ReportRequest`, runs the query for its `type`, renders the result into
 * the requested `format`, and writes the outcome back onto the same row.
 * On any error it marks the row FAILED and re-throws so `JobWorkerService`'s
 * existing retry/dead-letter logic still applies.
 */
@Injectable()
export class ReportGenerationProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ReportGenerationProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: JobProcessorRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(REPORT_GENERATION_JOB_TYPE, (payload, job) =>
      this.process(payload, job),
    );
  }

  private async process(payload: Prisma.JsonValue, _job: BackgroundJob): Promise<void> {
    if (!isReportGenerationPayload(payload)) {
      throw new Error("REPORT_GENERATION job payload missing reportRequestId");
    }

    const { reportRequestId } = payload;

    const reportRequest = await this.prisma.reportRequest.findUnique({
      where: { id: reportRequestId },
    });
    if (!reportRequest) {
      throw new Error(`ReportRequest ${reportRequestId} not found`);
    }

    await this.prisma.reportRequest.update({
      where: { id: reportRequestId },
      data: { status: ReportStatus.PROCESSING },
    });

    try {
      const rows = await runReportQuery(
        this.prisma,
        reportRequest.type,
        reportRequest.organizationId,
        reportRequest.filters,
      );
      const rendered = await renderReport(reportRequest.type, reportRequest.format, rows);

      await this.prisma.reportRequest.update({
        where: { id: reportRequestId },
        data: {
          status: ReportStatus.SUCCESS,
          resultData: Uint8Array.from(rendered.data),
          filename: rendered.filename,
          mimeType: rendered.mimeType,
          error: null,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report generation failed";
      this.logger.error(`Report generation failed for ${reportRequestId}: ${message}`);

      await this.prisma.reportRequest.update({
        where: { id: reportRequestId },
        data: {
          status: ReportStatus.FAILED,
          error: message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }
}
