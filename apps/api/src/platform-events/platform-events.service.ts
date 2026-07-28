import { Injectable, NotFoundException } from "@nestjs/common";
import { PlatformEventStatus, type PlatformEventType, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BackgroundJobsService } from "../background-jobs/background-jobs.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { ListPlatformEventsQueryDto } from "./dto/list-platform-events-query.dto";

export interface PublishRefs {
  organizationId?: string;
  applicationId?: string;
  customerId?: string;
}

/**
 * The Platform Event Bus. `publish()` is the ONLY thing every business
 * action calls - it is purely additive alongside whatever that action
 * already does (see the schema's Phase 10 header comment): it durably
 * records the event (Event History / search / audit) and enqueues one
 * `BackgroundJob` per enabled `AutomationRule` whose trigger matches, so
 * every reaction happens asynchronously via the worker, never inline on
 * the caller's request path.
 */
@Injectable()
export class PlatformEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobs: BackgroundJobsService,
  ) {}

  async publish(
    type: PlatformEventType,
    payload: Prisma.InputJsonValue,
    refs: PublishRefs = {},
    correlationId?: string,
  ) {
    const event = await this.prisma.platformEvent.create({
      data: {
        type,
        payload,
        organizationId: refs.organizationId,
        applicationId: refs.applicationId,
        customerId: refs.customerId,
        correlationId,
      },
    });

    const rules = await this.prisma.automationRule.findMany({
      where: { triggerEventType: type, enabled: true },
      select: { id: true },
    });

    if (rules.length === 0) {
      // Nothing subscribes to this event type right now - there is no
      // pending dispatch work, so the event is trivially "dispatched".
      await this.prisma.platformEvent.update({
        where: { id: event.id },
        data: { status: PlatformEventStatus.DISPATCHED },
      });
      return event;
    }

    await Promise.all(
      rules.map((rule) =>
        this.backgroundJobs.enqueue(
          "AUTOMATION_RULE_EXECUTION",
          { ruleId: rule.id, eventId: event.id },
          { correlationId, sourceEventId: event.id },
        ),
      ),
    );

    return event;
  }

  async list(query: ListPlatformEventsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.PlatformEventWhereInput = {
      type: query.type,
      status: query.status,
      organizationId: query.organizationId,
      applicationId: query.applicationId,
      customerId: query.customerId,
      correlationId: query.correlationId,
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.platformEvent.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(eventId: string) {
    const event = await this.prisma.platformEvent.findUnique({
      where: { id: eventId },
      include: {
        jobs: { orderBy: { createdAt: "asc" } },
        automationRuleRuns: { include: { rule: true }, orderBy: { startedAt: "asc" } },
      },
    });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }
}
