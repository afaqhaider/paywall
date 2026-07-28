import { Injectable, NotFoundException } from "@nestjs/common";
import type { Trial } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";

@Injectable()
export class TrialsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.trial.findMany({
      where: cursorWhere
        ? { customer: { organizationId }, ...cursorWhere }
        : { customer: { organizationId } },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: { customer: true, plan: true },
    });

    return paginateResults(rows, limit);
  }

  async getOne(trialId: string, organizationId: string): Promise<Trial> {
    const trial = await this.prisma.trial.findUnique({
      where: { id: trialId },
      include: { customer: true },
    });
    if (!trial || trial.customer.organizationId !== organizationId) {
      throw new NotFoundException("Trial not found");
    }
    return trial;
  }
}
