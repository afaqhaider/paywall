import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { AdminAuditLogQueryDto } from "./dto/admin-audit-query.dto";

const ALL_ACTIONS = Object.values(AuditAction) as AuditAction[];

/** Hard cap on `/admin/audit-log/export` - keeps the CSV export a bounded, in-memory operation rather than an unbounded stream. Bump if operators need more, but do it deliberately. */
const EXPORT_ROW_CAP = 10_000;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Cross-org, cross-app Audit Center. This is deliberately a MORE GENERAL
 * version of `AuditService.listForOrganization`/`listForApplication` -
 * same `AuditLog` table, no new model, but filterable/paginated/exportable
 * across the whole platform rather than scoped to one org or app.
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private matchingActions(search: string): AuditAction[] {
    const needle = search.toLowerCase();
    return ALL_ACTIONS.filter((action) => action.toLowerCase().includes(needle));
  }

  private buildWhere(
    query: AdminAuditLogQueryDto,
    cursorWhere?: Prisma.AuditLogWhereInput,
  ): Prisma.AuditLogWhereInput {
    const conditions: Prisma.AuditLogWhereInput[] = [];

    if (cursorWhere) conditions.push(cursorWhere);
    if (query.organizationId) conditions.push({ organizationId: query.organizationId });
    if (query.applicationId) conditions.push({ applicationId: query.applicationId });
    if (query.userId) conditions.push({ userId: query.userId });
    if (query.action) conditions.push({ action: query.action });

    if (query.from || query.to) {
      conditions.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }

    if (query.search) {
      // No matches -> force an empty result set rather than ignoring the filter.
      conditions.push({ action: { in: this.matchingActions(query.search) } });
    }

    return conditions.length ? { AND: conditions } : {};
  }

  async list(query: AdminAuditLogQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);
    const where = this.buildWhere(query, cursorWhere);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: CURSOR_ORDER_BY, // createdAt desc, id desc - the "Timeline" view is just this chronological order.
      take: limit + 1,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        organization: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
      },
    });

    return paginateResults(rows, limit);
  }

  async exportCsv(query: AdminAuditLogQueryDto): Promise<string> {
    const where = this.buildWhere(query);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORT_ROW_CAP,
      include: {
        user: { select: { email: true } },
        organization: { select: { name: true } },
        application: { select: { name: true } },
      },
    });

    const header = [
      "id",
      "action",
      "createdAt",
      "userId",
      "userEmail",
      "organizationId",
      "organizationName",
      "applicationId",
      "applicationName",
      "ipAddress",
      "userAgent",
      "metadata",
    ];

    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.action,
          row.createdAt.toISOString(),
          row.userId ?? "",
          row.user?.email ?? "",
          row.organizationId ?? "",
          row.organization?.name ?? "",
          row.applicationId ?? "",
          row.application?.name ?? "",
          row.ipAddress ?? "",
          row.userAgent ?? "",
          row.metadata ? JSON.stringify(row.metadata) : "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    return lines.join("\r\n");
  }
}
