import { Module } from "@nestjs/common";
import { BackgroundJobsController } from "./background-jobs.controller";
import { BackgroundJobsService } from "./background-jobs.service";
import { JobWorkerService } from "./job-worker.service";
import { JobProcessorRegistryService } from "./job-processor-registry.service";

/**
 * The generic Background Worker framework: `BackgroundJobsService` (enqueue/
 * cancel/retry/queue pause-resume), `JobWorkerService` (the polling sweep
 * that actually runs jobs), and `JobProcessorRegistryService` (where other
 * modules register what a given job `type` does). Every other Phase 10
 * feature - automation rules, the scheduler, notification delivery -
 * builds on this instead of rolling its own queue.
 */
@Module({
  controllers: [BackgroundJobsController],
  providers: [BackgroundJobsService, JobWorkerService, JobProcessorRegistryService],
  exports: [BackgroundJobsService, JobProcessorRegistryService],
})
export class BackgroundJobsModule {}
