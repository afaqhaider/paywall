import { Module } from "@nestjs/common";
import { SystemHealthController } from "./system-health.controller";
import { SystemHealthService, SYSTEM_HEALTH_PROVIDERS } from "./system-health.service";
import { DatabaseHealthProvider } from "./providers/database-health.provider";
import { QueueHealthProvider } from "./providers/queue-health.provider";
import { WorkerHealthProvider } from "./providers/worker-health.provider";
import { ErpHealthProvider } from "./providers/erp-health.provider";
import { WebhookHealthProvider } from "./providers/webhook-health.provider";
import { NotificationHealthProvider } from "./providers/notification-health.provider";
import { StorageHealthProvider } from "./providers/storage-health.provider";
import { CacheHealthProvider } from "./providers/cache-health.provider";
import { ApplicationHealthProvider } from "./providers/application-health.provider";

@Module({
  controllers: [SystemHealthController],
  providers: [
    SystemHealthService,
    DatabaseHealthProvider,
    QueueHealthProvider,
    WorkerHealthProvider,
    ErpHealthProvider,
    WebhookHealthProvider,
    NotificationHealthProvider,
    StorageHealthProvider,
    CacheHealthProvider,
    ApplicationHealthProvider,
    {
      provide: SYSTEM_HEALTH_PROVIDERS,
      useFactory: (
        database: DatabaseHealthProvider,
        queue: QueueHealthProvider,
        worker: WorkerHealthProvider,
        erp: ErpHealthProvider,
        webhook: WebhookHealthProvider,
        notification: NotificationHealthProvider,
        storage: StorageHealthProvider,
        cache: CacheHealthProvider,
        application: ApplicationHealthProvider,
      ) => [database, queue, worker, erp, webhook, notification, storage, cache, application],
      inject: [
        DatabaseHealthProvider,
        QueueHealthProvider,
        WorkerHealthProvider,
        ErpHealthProvider,
        WebhookHealthProvider,
        NotificationHealthProvider,
        StorageHealthProvider,
        CacheHealthProvider,
        ApplicationHealthProvider,
      ],
    },
  ],
})
export class SystemHealthModule {}
