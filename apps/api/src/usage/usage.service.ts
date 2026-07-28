import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { CreateUsageRecordDto } from "./dto/create-usage-record.dto";

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(organizationId: string, dto: CreateUsageRecordDto) {
    const existing = await this.prisma.usageRecord.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const [customer] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({ where: { id: dto.customerId } }),
      this.prisma.feature.findUniqueOrThrow({ where: { id: dto.featureId } }),
    ]);

    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Customer not found in this organization");
    }

    try {
      return await this.prisma.usageRecord.create({
        data: {
          customerId: dto.customerId,
          subscriptionId: dto.subscriptionId,
          featureId: dto.featureId,
          quantity: dto.quantity,
          idempotencyKey: dto.idempotencyKey,
          source: dto.source,
          metadata: dto.metadata,
        },
      });
    } catch {
      throw new ConflictException("A usage record with this idempotency key already exists");
    }
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.usageRecord.findMany({
      where: cursorWhere
        ? { customer: { organizationId }, ...cursorWhere }
        : { customer: { organizationId } },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }
}
