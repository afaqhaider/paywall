import { Injectable, NotFoundException } from "@nestjs/common";
import type { Notification, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { NotificationQueryDto } from "./dto/notification-query.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reusable creation entry point for other code (billing/security/sync/
   * system events) to call once those trigger points are wired up. Not
   * invoked automatically by anything yet - the same "built but not yet
   * triggered by real events" scope boundary Phase 7 drew around
   * `WebhookEndpoint`'s delivery `enqueue()`.
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<Notification> {
    return this.prisma.notification.create({ data: { userId, type, title, body, metadata } });
  }

  async list(userId: string, query: NotificationQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async markRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
