import { Module } from "@nestjs/common";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [SubscriptionsModule],
  controllers: [AdminSubscriptionsController],
  providers: [AdminSubscriptionsService, PlatformAdminGuard],
})
export class AdminSubscriptionsModule {}
