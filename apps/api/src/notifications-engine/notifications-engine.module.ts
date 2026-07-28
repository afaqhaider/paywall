import { Module } from "@nestjs/common";
import { NotificationTemplatesController } from "./notification-templates.controller";
import { NotificationTemplatesService } from "./notification-templates.service";
import { PlatformNotificationsController } from "./platform-notifications.controller";
import { PlatformNotificationsService } from "./platform-notifications.service";
import { NotificationDeliveryProcessorService } from "./notification-delivery-processor.service";
import { BackgroundJobsModule } from "../background-jobs/background-jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [BackgroundJobsModule, MailModule, NotificationsModule],
  controllers: [NotificationTemplatesController, PlatformNotificationsController],
  providers: [
    NotificationTemplatesService,
    PlatformNotificationsService,
    NotificationDeliveryProcessorService,
  ],
  exports: [PlatformNotificationsService],
})
export class NotificationsEngineModule {}
