import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PaymentWebhookStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProviderResolverService } from "./provider-resolver.service";
import { PaymentEventDispatcherService } from "./payment-event-dispatcher.service";

/**
 * The generic webhook pipeline: receive -> verify signature -> normalize
 * into platform events -> idempotency check -> store raw payload ->
 * dispatch -> log. Every provider's webhook lands on the same endpoint
 * shape (`POST /webhooks/payments/:providerId`) and flows through this one
 * class - only `adapter.verifyWebhook`/`normalizeWebhookEvent` differ per
 * provider.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProviderResolverService,
    private readonly dispatcher: PaymentEventDispatcherService,
  ) {}

  async handleIncoming(
    providerId: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: number; processed: number }> {
    const { adapter, credentials, organizationId } = await this.resolver.resolve(providerId);

    const signatureValid = adapter.verifyWebhook(rawBody, headers, credentials);
    if (!signatureValid) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const events = adapter.normalizeWebhookEvent(rawBody, headers);
    let processed = 0;

    for (const event of events) {
      const existing = await this.prisma.paymentWebhook.findUnique({
        where: {
          providerId_externalEventId: { providerId, externalEventId: event.externalEventId },
        },
      });

      if (existing?.status === PaymentWebhookStatus.PROCESSED) {
        // Idempotent replay - never reprocess an already-applied event.
        continue;
      }

      const webhookRow = existing
        ? existing
        : await this.prisma.paymentWebhook.create({
            data: {
              providerId,
              externalEventId: event.externalEventId,
              eventType: event.type,
              normalizedType: event.type,
              payload: event.raw as object,
              signatureValid: true,
              status: PaymentWebhookStatus.VERIFIED,
              relatedSubscriptionId: event.externalSubscriptionId,
              relatedTransactionId: event.externalTransactionId,
            },
          });

      try {
        await this.dispatcher.dispatch(providerId, organizationId, event);
        await this.prisma.paymentWebhook.update({
          where: { id: webhookRow.id },
          data: { status: PaymentWebhookStatus.PROCESSED, processedAt: new Date() },
        });
        processed += 1;
      } catch (error) {
        this.logger.warn(
          `Webhook dispatch failed for ${providerId}/${event.externalEventId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await this.prisma.paymentWebhook.update({
          where: { id: webhookRow.id },
          data: {
            status: PaymentWebhookStatus.FAILED,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return { received: events.length, processed };
  }

  async list(organizationId: string, providerId?: string) {
    return this.prisma.paymentWebhook.findMany({
      where: providerId
        ? { providerId, provider: { organizationId } }
        : { provider: { organizationId } },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  }
}
