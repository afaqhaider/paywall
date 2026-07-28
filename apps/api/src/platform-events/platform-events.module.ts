import { Module } from "@nestjs/common";
import { PlatformEventsController } from "./platform-events.controller";
import { PlatformEventsService } from "./platform-events.service";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";

/**
 * The Platform Event Bus. Every business module that wants to publish an
 * event imports this module and injects `PlatformEventsService` - it is
 * the one and only publish path (see that service's doc comment).
 */
@Module({
  imports: [BackgroundJobsModule],
  controllers: [PlatformEventsController],
  providers: [PlatformEventsService],
  exports: [PlatformEventsService],
})
export class PlatformEventsModule {}
