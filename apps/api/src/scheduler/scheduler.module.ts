import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";
import { SchedulerService } from "./scheduler.service";

/**
 * Phase 10 Scheduler module: registers the 9 platform-maintenance
 * scheduled-task processors with the generic Background Job framework
 * (`BackgroundJobsModule`) and enqueues each as a recurring job on
 * startup. No controllers of its own - queue/job inspection for these
 * tasks (grouped under the "scheduled" queue name) is already exposed
 * by `BackgroundJobsController` at `admin/jobs`.
 */
@Module({
  imports: [BackgroundJobsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
