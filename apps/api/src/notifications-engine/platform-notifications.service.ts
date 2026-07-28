import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BackgroundJobsService } from "../background-jobs/background-jobs.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { SendNotificationDto } from "./dto/send-notification.dto";
import type { ListPlatformNotificationsQueryDto } from "./dto/list-platform-notifications-query.dto";

export const NOTIFICATION_DELIVERY_JOB_TYPE = "NOTIFICATION_DELIVERY";
const NOTIFICATION_QUEUE_NAME = "notifications";

/**
 * The single entry point every notification-producing feature (automation
 * rules, scheduler reminders, admin announcements, future business-service
 * hooks) must call through - never construct `NotificationDelivery` rows
 * directly elsewhere. `send()` records one `PlatformNotification` plus one
 * `NotificationDelivery` per resolved channel, then enqueues one
 * `NOTIFICATION_DELIVERY` background job per delivery - actual sending
 * always happens asynchronously via `NotificationDeliveryProcessorService`.
 */
@Injectable()
export class PlatformNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobsService: BackgroundJobsService,
  ) {}

  async send(dto: SendNotificationDto) {
    const notification = await this.prisma.platformNotification.create({
      data: {
        category: dto.category,
        recipientUserId: dto.recipientUserId,
        organizationId: dto.organizationId,
        customerId: dto.customerId,
        payload: dto.payload as Prisma.InputJsonValue,
        correlationId: dto.correlationId,
      },
    });

    const channels = dto.channels?.length
      ? dto.channels
      : (
          await this.prisma.notificationTemplate.findMany({
            where: { category: dto.category, isActive: true },
            select: { channel: true },
          })
        ).map((t) => t.channel);

    const uniqueChannels = [...new Set(channels)];

    for (const channel of uniqueChannels) {
      const template = await this.prisma.notificationTemplate.findFirst({
        where: { category: dto.category, channel, isActive: true },
      });

      const delivery = await this.prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          templateId: template?.id,
          channel,
        },
      });

      await this.backgroundJobsService.enqueue(
        NOTIFICATION_DELIVERY_JOB_TYPE,
        { deliveryId: delivery.id },
        { queueName: NOTIFICATION_QUEUE_NAME, correlationId: dto.correlationId },
      );
    }

    return notification;
  }

  async list(query: ListPlatformNotificationsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.platformNotification.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.recipientUserId ? { recipientUserId: query.recipientUserId } : {}),
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(cursorWhere ?? {}),
      },
      include: { deliveries: true },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(notificationId: string) {
    const notification = await this.prisma.platformNotification.findUnique({
      where: { id: notificationId },
      include: { deliveries: { include: { template: true } } },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    return notification;
  }
}
