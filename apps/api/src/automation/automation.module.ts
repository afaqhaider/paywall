import { Module } from "@nestjs/common";
import { AutomationRulesController } from "./automation-rules.controller";
import { AutomationRulesService } from "./automation-rules.service";
import { AutomationActionExecutorService } from "./automation-action-executor.service";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";
import { NotificationsEngineModule } from "../notifications-engine/notifications-engine.module";

@Module({
  imports: [BackgroundJobsModule, NotificationsEngineModule],
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService, AutomationActionExecutorService],
  exports: [AutomationRulesService],
})
export class AutomationModule {}
