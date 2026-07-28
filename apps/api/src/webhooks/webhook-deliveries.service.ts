import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { WebhookDeliveryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { ListWebhookDeliveriesQueryDto } from "./dto/list-webhook-deliveries-query.dto";
import { WebhookDispatchService } from "./webhook-dispatch.service";

const RETRYABLE_STATUSES: WebhookDeliveryStatus[] = [
  WebhookDeliveryStatus.FAILED,
  WebhookDeliveryStatus.EXHAUSTED,
];

@Injectable()
export class WebhookDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly dispatchService: WebhookDispatchService,
  ) {}

  async list(webhookEndpointId: string, query: ListWebhookDeliveriesQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where = {
      webhookEndpointId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.webhookDelivery.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(webhookEndpointId: string, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { retries: { orderBy: { attemptNumber: "asc" } } },
    });

    if (!delivery || delivery.webhookEndpointId !== webhookEndpointId) {
      throw new NotFoundException("Delivery not found");
    }

    return delivery;
  }

  async retry(webhookEndpointId: string, deliveryId: string, userId: string, meta: RequestMeta) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhookEndpoint: { select: { applicationId: true } } },
    });

    if (!delivery || delivery.webhookEndpointId !== webhookEndpointId) {
      throw new NotFoundException("Delivery not found");
    }

    if (!RETRYABLE_STATUSES.includes(delivery.status)) {
      throw new BadRequestException("only FAILED or EXHAUSTED deliveries can be retried");
    }

    const updated = await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: WebhookDeliveryStatus.RETRYING, nextAttemptAt: new Date() },
    });

    await this.auditService.record({
      action: "WEBHOOK_DELIVERY_RETRIED",
      userId,
      applicationId: delivery.webhookEndpoint.applicationId,
      metadata: { webhookEndpointId, deliveryId },
      ...meta,
    });

    // Fire-and-forget: don't make the caller wait on the outbound HTTP call;
    // the periodic sweep would pick this up anyway, this just kicks it off
    // sooner. Failures are handled (and logged) inside attemptDelivery itself.
    void this.dispatchService.attemptDelivery(deliveryId);

    return updated;
  }
}
