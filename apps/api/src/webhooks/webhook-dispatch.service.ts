import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { createHmac } from "crypto";
import { WebhookDeliveryStatus, WebhookEndpointStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decryptSecret } from "../common/utils/encryption.util";

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MINUTES = 60;
const DELIVERY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX_LENGTH = 5_000;
const SWEEP_INTERVAL_MS = 30_000;
const SWEEP_BATCH_SIZE = 20;

/**
 * Sends outbound webhook events (entitlement/subscription/license lifecycle,
 * etc.) to developers' own registered `WebhookEndpoint` URLs, with HMAC
 * signing and an in-process retry loop. Unrelated to `apps/api/src/payments`'
 * inbound `PaymentWebhook` pipeline (webhooks arriving FROM payment
 * providers) - this service only ever sends, never receives.
 */
@Injectable()
export class WebhookDispatchService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatchService.name);
  private sweepHandle?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Skip the background sweep in tests so it doesn't keep the process
    // alive or race against a test's own timers/mocked DB state.
    if (process.env.NODE_ENV === "test") {
      return;
    }

    this.sweepHandle = setInterval(() => {
      this.processPending().catch((error: unknown) => {
        this.logger.error(
          "Webhook delivery sweep failed",
          error instanceof Error ? error.stack : error,
        );
      });
    }, SWEEP_INTERVAL_MS);
    this.sweepHandle.unref?.();
  }

  /**
   * Creates a pending delivery for `eventType` on `webhookEndpointId`, but
   * only if the endpoint is ENABLED and either subscribes to no specific
   * event types (empty `eventTypes` array == "all events") or explicitly
   * lists `eventType`. Other phases can call this once they have a real
   * event to fire (e.g. `dispatch.enqueue(endpointId, "entitlement.granted", {...})`) -
   * wiring that up to actual domain events is out of scope here.
   */
  async enqueue(webhookEndpointId: string, eventType: string, payload: object): Promise<void> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookEndpointId },
      select: { status: true, eventTypes: true },
    });

    if (!endpoint || endpoint.status !== WebhookEndpointStatus.ENABLED) {
      return;
    }

    if (endpoint.eventTypes.length > 0 && !endpoint.eventTypes.includes(eventType)) {
      return;
    }

    await this.prisma.webhookDelivery.create({
      data: {
        webhookEndpointId,
        eventType,
        payload: payload as object,
        status: WebhookDeliveryStatus.PENDING,
      },
    });
  }

  /**
   * Loads a delivery and its endpoint's active secret, signs and POSTs the
   * payload, and records the outcome (success/retry/exhaustion) plus a
   * `WebhookRetry` audit row for this attempt. Safe to call directly (e.g.
   * for a manual retry) or from the periodic sweep.
   */
  async attemptDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhookEndpoint: {
          include: { secrets: { where: { isActive: true }, take: 1 } },
        },
      },
    });

    if (!delivery) {
      return;
    }

    const activeSecret = delivery.webhookEndpoint.secrets[0];
    if (!activeSecret) {
      this.logger.warn(
        `Webhook endpoint ${delivery.webhookEndpointId} has no active secret; skipping delivery ${deliveryId}`,
      );
      return;
    }

    const rawBody = JSON.stringify(delivery.payload);
    const signature = createHmac("sha256", decryptSecret(activeSecret))
      .update(rawBody)
      .digest("hex");

    const result = await this.sendWebhookRequest(
      delivery.webhookEndpoint.url,
      rawBody,
      signature,
      delivery.eventType,
      delivery.id,
    );

    const attemptNumber = delivery.attemptCount + 1;

    if (result.ok) {
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: WebhookDeliveryStatus.SUCCESS,
            attemptCount: attemptNumber,
            responseStatus: result.responseStatus,
            responseBody: result.responseBody,
            deliveredAt: new Date(),
            nextAttemptAt: null,
          },
        }),
        this.prisma.webhookRetry.create({
          data: {
            webhookDeliveryId: delivery.id,
            attemptNumber,
            responseStatus: result.responseStatus,
          },
        }),
      ]);
      return;
    }

    const exhausted = attemptNumber >= MAX_ATTEMPTS;
    const nextAttemptAt = exhausted ? null : this.computeNextAttemptAt(attemptNumber);

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? WebhookDeliveryStatus.EXHAUSTED : WebhookDeliveryStatus.RETRYING,
          attemptCount: attemptNumber,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody,
          nextAttemptAt,
        },
      }),
      this.prisma.webhookRetry.create({
        data: {
          webhookDeliveryId: delivery.id,
          attemptNumber,
          responseStatus: result.responseStatus,
          error: result.error,
        },
      }),
    ]);
  }

  /** Finds due PENDING/RETRYING deliveries and attempts each, bounded to a small batch per sweep. */
  async processPending(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.RETRYING] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: { id: true },
      take: SWEEP_BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    for (const { id } of due) {
      await this.attemptDelivery(id).catch((error: unknown) => {
        this.logger.error(
          `Delivery attempt failed for ${id}`,
          error instanceof Error ? error.stack : error,
        );
      });
    }
  }

  /** The only place this service makes an outbound HTTP call - kept isolated so the send path is easy to audit in one glance. */
  private async sendWebhookRequest(
    url: string,
    rawBody: string,
    signature: string,
    eventType: string,
    deliveryId: string,
  ): Promise<{ ok: boolean; responseStatus?: number; responseBody?: string; error?: string }> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": eventType,
          "X-Webhook-Delivery-Id": deliveryId,
        },
        body: rawBody,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });

      const bodyText = await response.text().catch(() => "");

      return {
        ok: response.status >= 200 && response.status < 300,
        responseStatus: response.status,
        responseBody: bodyText.slice(0, RESPONSE_BODY_MAX_LENGTH),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown network error",
      };
    }
  }

  private computeNextAttemptAt(attemptNumber: number): Date {
    const backoffMinutes = Math.min(2 ** attemptNumber, MAX_BACKOFF_MINUTES);
    return new Date(Date.now() + backoffMinutes * 60_000);
  }
}
