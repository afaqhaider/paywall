import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobProcessorRegistryService } from "../background-jobs/job-processor-registry.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { renderTemplate } from "./template-render.util";
import { NOTIFICATION_DELIVERY_JOB_TYPE } from "./platform-notifications.service";

/**
 * Registers the `NOTIFICATION_DELIVERY` job processor - the only place that
 * actually sends a notification, always invoked asynchronously by the
 * Background Job worker (never called synchronously from `send()`).
 *
 * EMAIL reuses the existing `MailService` (Phase 1); IN_APP reuses the
 * existing `NotificationsService` (Phase 8's simple in-app inbox) - neither
 * is duplicated here. PUSH/WEBHOOK/SMS have no real provider wired up in
 * this local-first platform, so they are documented log-only stubs (per
 * the spec's own "Future SMS" wording) that still mark the delivery SENT.
 */
@Injectable()
export class NotificationDeliveryProcessorService implements OnModuleInit {
  private readonly logger = new Logger(NotificationDeliveryProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: JobProcessorRegistryService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(NOTIFICATION_DELIVERY_JOB_TYPE, (payload) => this.deliver(payload));
  }

  private async deliver(payload: Prisma.JsonValue): Promise<void> {
    const { deliveryId } = payload as { deliveryId: string };

    const delivery = await this.prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { notification: true, template: true },
    });

    const notificationPayload = delivery.notification.payload as Record<string, unknown>;
    const bodyTemplate =
      delivery.template?.bodyTemplate ?? `${delivery.notification.category} notification`;
    const body = renderTemplate(bodyTemplate, notificationPayload);
    const subject = delivery.template?.subject
      ? renderTemplate(delivery.template.subject, notificationPayload)
      : delivery.notification.category;

    switch (delivery.channel) {
      case "EMAIL": {
        const to = notificationPayload.email as string | undefined;
        if (!to) {
          throw new Error(`No "email" field in notification payload for delivery ${deliveryId}`);
        }
        await this.mailService.send({ to, subject, body });
        break;
      }
      case "IN_APP": {
        if (!delivery.notification.recipientUserId) {
          throw new Error(`No recipientUserId on notification for IN_APP delivery ${deliveryId}`);
        }
        await this.notificationsService.create(
          delivery.notification.recipientUserId,
          "GENERAL",
          subject,
          body,
        );
        break;
      }
      case "PUSH":
      case "WEBHOOK":
      case "SMS":
        this.logger.log(
          `[stub - no ${delivery.channel} provider configured] delivery=${deliveryId} subject="${subject}" body="${body}"`,
        );
        break;
    }

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: "SENT", sentAt: new Date(), attemptCount: { increment: 1 } },
    });
  }
}
