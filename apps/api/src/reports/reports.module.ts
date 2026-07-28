import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportGenerationProcessorService } from "./report-generation-processor.service";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";

/**
 * Marketplace/Analytics & Platform Intelligence reporting slice (Phase 11).
 * Report generation is asynchronous: `ReportsService.requestReport()`
 * creates a `ReportRequest` row and enqueues a `REPORT_GENERATION` job via
 * the existing Phase 10 background job framework;
 * `ReportGenerationProcessorService` registers the processor that actually
 * runs the report query and renders the output, writing the result back
 * onto the same row (`Bytes` column - no object storage backend exists).
 */
@Module({
  imports: [BackgroundJobsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGenerationProcessorService],
  exports: [ReportsService],
})
export class ReportsModule {}
