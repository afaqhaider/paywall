import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialProviderType, SyncStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { ListFinancialSyncQueryDto } from "./dto/list-financial-sync-query.dto";
import { SyncEngineService } from "./sync-engine.service";

const RETRYABLE_STATUSES: SyncStatus[] = [SyncStatus.FAILED, SyncStatus.DEAD_LETTER];

/** Org-staff read/manage surface over the sync engine's state. Not used by
 * the Customer Portal - that agent reads `FinancialSync`/`FinancialEvent`
 * directly for its own customer-facing invoice/receipt/transaction views. */
@Injectable()
export class FinancialSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly syncEngine: SyncEngineService,
  ) {}

  async getStatus(organizationId: string) {
    const [pendingCount, retryingCount, deadLetterCount, integration] = await Promise.all([
      this.prisma.financialSync.count({
        where: { financialEvent: { organizationId }, status: SyncStatus.PENDING },
      }),
      this.prisma.financialSync.count({
        where: { financialEvent: { organizationId }, status: SyncStatus.RETRYING },
      }),
      this.prisma.financialSync.count({
        where: { financialEvent: { organizationId }, status: SyncStatus.DEAD_LETTER },
      }),
      this.prisma.financialIntegration.findUnique({
        where: { organizationId },
        include: { erpConnection: { select: { lastSyncedAt: true } } },
      }),
    ]);

    const provider = integration?.provider ?? FinancialProviderType.INTERNAL;
    const lastSyncedAt =
      provider === FinancialProviderType.LEDGIX_ERP
        ? (integration?.erpConnection?.lastSyncedAt ?? null)
        : null;

    return { provider, pendingCount, retryingCount, deadLetterCount, lastSyncedAt };
  }

  async listHistory(organizationId: string, query: ListFinancialSyncQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where = {
      financialEvent: { organizationId },
      ...(query.status ? { status: query.status } : {}),
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.financialSync.findMany({
      where,
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: { financialEvent: { select: { id: true, type: true } } },
    });

    return paginateResults(rows, limit);
  }

  async getHistoryDetail(organizationId: string, financialSyncId: string) {
    const sync = await this.prisma.financialSync.findUnique({
      where: { id: financialSyncId },
      include: {
        history: { orderBy: { attemptNumber: "asc" } },
        error: true,
        financialEvent: { select: { id: true, type: true, payload: true, organizationId: true } },
      },
    });

    if (!sync || sync.financialEvent.organizationId !== organizationId) {
      throw new NotFoundException("Financial sync not found");
    }

    return sync;
  }

  /** Support manual retry: resets a FAILED/DEAD_LETTER sync back to PENDING
   * and, if a `SyncError` exists, marks it resolved. Kicks off an immediate
   * attempt rather than waiting for the next sweep tick. */
  async retry(organizationId: string, financialSyncId: string, userId: string, meta: RequestMeta) {
    const sync = await this.prisma.financialSync.findUnique({
      where: { id: financialSyncId },
      include: { financialEvent: { select: { organizationId: true } }, error: true },
    });

    if (!sync || sync.financialEvent.organizationId !== organizationId) {
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
              data: { resolved: true, resolvedAt: new Date(), resolvedById: userId },
            }),
          ]
        : []),
    ]);

    await this.auditService.record({
      action: "FINANCIAL_SYNC_RETRIED",
      userId,
      organizationId,
      metadata: { financialSyncId },
      ...meta,
    });

    // Fire-and-forget: don't make the caller wait on the ERP round-trip; the
    // periodic sweep would pick this up anyway, this just kicks it off
    // sooner. Failures are handled (and logged) inside attemptSync itself.
    void this.syncEngine.attemptSync(financialSyncId);

    return updated;
  }
}
