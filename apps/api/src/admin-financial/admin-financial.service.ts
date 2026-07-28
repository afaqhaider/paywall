import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentTransactionStatus, SyncStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { ListAdminFinancialEventsQueryDto } from "./dto/list-admin-financial-events-query.dto";

const PENDING_SYNC_STATUSES: SyncStatus[] = [SyncStatus.PENDING, SyncStatus.RETRYING];
const FAILED_TRANSACTION_STATUSES: PaymentTransactionStatus[] = [
  PaymentTransactionStatus.FAILED,
  PaymentTransactionStatus.CHARGEBACK,
];
/** Same set `FinancialSyncService.retry()` (Phase 8, org-scoped) accepts. */
const RETRYABLE_STATUSES: SyncStatus[] = [SyncStatus.FAILED, SyncStatus.DEAD_LETTER];

/**
 * Cross-organization admin view over Phase 8's financial integration/sync
 * pipeline. Reuses `FinancialSync`/`SyncError`/`PaymentTransaction`/
 * `FinancialEvent` exactly as Phase 8 modeled them - this module only ever
 * reads across every organization instead of one, and its `retry()` mirrors
 * `FinancialSyncService.retry()`'s logic exactly minus the org-membership
 * check (replaced by `PlatformAdminGuard`).
 *
 * Deviation from Phase 8's retry: that method also fires
 * `SyncEngineService.attemptSync()` immediately as a "don't make the admin
 * wait for the next sweep tick" nicety. `SyncEngineService` is not exported
 * from `FinancialEventsModule`, and exporting it just for this one
 * fire-and-forget call was judged not worth widening that module's public
 * surface - the periodic sweep (every 30s) picks up the re-armed PENDING
 * row on its own, just slightly later.
 */
@Injectable()
export class AdminFinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listIntegrations(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.financialIntegration.findMany({
      where: cursorWhere,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        organization: { select: { id: true, name: true } },
        erpConnection: { select: { status: true, lastSyncedAt: true, lastTestedAt: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async listPendingSyncs(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.financialSync.findMany({
      where: {
        status: { in: PENDING_SYNC_STATUSES },
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        financialEvent: { select: { id: true, type: true, organizationId: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async listDeadLetter(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    // SyncError has no `id`/`createdAt` cursor pair of its own in the
    // migration-frozen schema (its natural key is `financialSyncId`, and its
    // timestamp is `occurredAt`) - so this list is cursor-paginated on the
    // parent `FinancialSync` row instead, which does have both.
    const rows = await this.prisma.financialSync.findMany({
      where: {
        status: SyncStatus.DEAD_LETTER,
        error: { resolved: false },
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        error: true,
        financialEvent: { select: { id: true, type: true, organizationId: true, payload: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async listFailedTransactions(query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.paymentTransaction.findMany({
      where: {
        status: { in: FAILED_TRANSACTION_STATUSES },
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: {
        customer: { select: { id: true, organizationId: true, displayName: true, email: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async listEvents(query: ListAdminFinancialEventsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.financialEvent.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: { sync: true },
    });

    return paginateResults(rows, limit);
  }

  /** Mirrors `FinancialSyncService.retry()` exactly (Phase 8), minus the
   * org-membership lookup - `PlatformAdminGuard` is the authorization here
   * instead. */
  async retry(financialSyncId: string, adminUserId: string, meta: RequestMeta) {
    const sync = await this.prisma.financialSync.findUnique({
      where: { id: financialSyncId },
      include: { financialEvent: { select: { organizationId: true } }, error: true },
    });

    if (!sync) {
      throw new NotFoundException("Financial sync not found");
    }

    if (!RETRYABLE_STATUSES.includes(sync.status)) {
      throw new BadRequestException("only FAILED or DEAD_LETTER syncs can be retried");
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.financialSync.update({
        where: { id: financialSyncId },
        data: { status: SyncStatus.PENDING, nextAttemptAt: new Date() },
      }),
      ...(sync.error
        ? [
            this.prisma.syncError.update({
              where: { financialSyncId },
              data: { resolved: true, resolvedAt: new Date(), resolvedById: adminUserId },
            }),
          ]
        : []),
    ]);

    await this.auditService.record({
      action: "FINANCIAL_SYNC_ADMIN_RETRIED",
      userId: adminUserId,
      organizationId: sync.financialEvent.organizationId,
      metadata: { financialSyncId },
      ...meta,
    });

    return updated;
  }
}
