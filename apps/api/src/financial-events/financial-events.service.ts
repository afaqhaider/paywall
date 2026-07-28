import { Injectable } from "@nestjs/common";
import { FinancialEventType, FinancialProviderType, Prisma, SyncStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { ListFinancialEventsQueryDto } from "./dto/list-financial-events-query.dto";

export interface FinancialEventRefs {
  applicationId?: string;
  customerId?: string;
  subscriptionId?: string;
}

/**
 * Records financial events and hands them off to the sync engine. This is
 * the ONLY intended entry point for reporting "something the financial side
 * needs to know about" - callers are whoever has a financial event to report
 * (an admin action today, a future webhook-pipeline wiring later). This
 * service does not hook into the payment/subscription webhook pipeline
 * itself, mirroring how Phase 7's `WebhookDispatchService.enqueue()` was
 * built generically without being wired to real domain events yet.
 */
@Injectable()
export class FinancialEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates the append-only `FinancialEvent` row, then atomically (one
   * `$transaction`) creates its `SyncQueue` entry (PENDING) and its
   * `FinancialSync` entry (PENDING, `provider` copied from the org's current
   * `FinancialIntegration.provider` at this moment - defaults to INTERNAL if
   * no `FinancialIntegration` row exists yet). Returns immediately: the
   * actual sync/ERP call happens later, off the request path, via
   * `SyncEngineService`'s periodic sweep - callers must never await an ERP
   * round-trip here ("do not block payment processing while waiting for
   * ERP").
   *
   * When `idempotencyKey` is supplied and a `FinancialEvent` with that key
   * already exists, this is a no-op that returns the existing row rather
   * than creating a duplicate trio - the guarantee the payment/subscription
   * pipeline relies on so a retried webhook, a self-transition retry, or a
   * doubly-invoked manual admin action never double-books revenue.
   */
  async record(
    organizationId: string,
    type: FinancialEventType,
    payload: Prisma.InputJsonValue,
    refs: FinancialEventRefs = {},
    userId?: string,
    meta?: RequestMeta,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.financialEvent.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return this.getWithSync(existing.id);
      }
    }

    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
      select: { provider: true },
    });
    const provider = integration?.provider ?? FinancialProviderType.INTERNAL;

    let event: { id: string };
    try {
      event = await this.prisma.$transaction(async (tx) => {
        const created = await tx.financialEvent.create({
          data: {
            organizationId,
            applicationId: refs.applicationId,
            customerId: refs.customerId,
            subscriptionId: refs.subscriptionId,
            type,
            payload,
            idempotencyKey,
          },
        });

        await tx.syncQueue.create({
          data: { financialEventId: created.id, status: SyncStatus.PENDING },
        });

        await tx.financialSync.create({
          data: { financialEventId: created.id, provider, status: SyncStatus.PENDING },
        });

        return created;
      });
    } catch (error) {
      // Unique violation on idempotencyKey = a concurrent caller won the
      // race; return their row rather than erroring.
      if (idempotencyKey && isUniqueConstraintError(error)) {
        const winner = await this.prisma.financialEvent.findUniqueOrThrow({
          where: { idempotencyKey },
        });
        return this.getWithSync(winner.id);
      }
      throw error;
    }

    await this.auditService.record({
      action: "FINANCIAL_EVENT_CREATED",
      organizationId,
      userId,
      applicationId: refs.applicationId,
      metadata: { financialEventId: event.id, type },
      ...meta,
    });

    return this.getWithSync(event.id);
  }

  async list(organizationId: string, query: ListFinancialEventsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.financialEvent.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: { sync: true },
    });

    return paginateResults(rows, limit);
  }

  private async getWithSync(financialEventId: string) {
    return this.prisma.financialEvent.findUnique({
      where: { id: financialEventId },
      include: { sync: true, queueEntry: true },
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
