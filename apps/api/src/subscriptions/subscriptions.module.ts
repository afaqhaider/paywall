import { Module } from "@nestjs/common";
import {
  SubscriptionsController,
  SubscriptionLifecycleController,
} from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { CouponsModule } from "../coupons/coupons.module";

@Module({
  imports: [CouponsModule],
  controllers: [SubscriptionsController, SubscriptionLifecycleController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
