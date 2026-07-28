import { Module } from "@nestjs/common";
import { WebhookEndpointsController } from "./webhook-endpoints.controller";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { WebhookDeliveriesController } from "./webhook-deliveries.controller";
import { WebhookDeliveriesService } from "./webhook-deliveries.service";
import { WebhookDispatchService } from "./webhook-dispatch.service";

/**
 * Outbound developer webhooks (Phase 7: Developer Portal) - endpoint CRUD,
 * delivery history/payload viewer, and the in-process HMAC-signed delivery
 * dispatch engine. Named `DeveloperWebhooksModule` (rather than
 * `WebhooksModule`) and mounted under `webhook-endpoints` so it can't be
 * confused with `apps/api/src/payments`' unrelated inbound `PaymentWebhook`
 * pipeline (`WebhooksModule`/`webhooks/payments`), which this module never
 * reads from or writes to.
 */
@Module({
  controllers: [WebhookEndpointsController, WebhookDeliveriesController],
  providers: [WebhookEndpointsService, WebhookDeliveriesService, WebhookDispatchService],
  exports: [WebhookDispatchService],
})
export class DeveloperWebhooksModule {}
