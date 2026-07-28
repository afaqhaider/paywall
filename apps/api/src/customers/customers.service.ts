import { Injectable, NotFoundException } from "@nestjs/common";
import type { Customer } from "@prisma/client";
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
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateCustomerDto, meta: RequestMeta) {
    if (dto.applicationId) {
      const application = await this.prisma.application.findUnique({
        where: { id: dto.applicationId },
      });
      if (!application || application.organizationId !== organizationId) {
        throw new NotFoundException("Application not found in this organization");
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        userId: dto.userId,
        type: dto.type,
        displayName: dto.displayName,
        email: dto.email,
        externalIds: dto.externalIds,
        metadata: dto.metadata,
      },
    });

    await this.auditService.record({
      action: "CUSTOMER_CREATED",
      userId,
      organizationId,
      applicationId: dto.applicationId,
      metadata: { customerId: customer.id },
      ...meta,
    });

    return customer;
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.customer.findMany({
      where: cursorWhere ? { organizationId, ...cursorWhere } : { organizationId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(customerId: string, organizationId: string): Promise<Customer> {
    return this.getOwned(customerId, organizationId);
  }

  async update(
    customerId: string,
    organizationId: string,
    userId: string,
    dto: UpdateCustomerDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(customerId, organizationId);

    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { ...dto },
    });

    await this.auditService.record({
      action: "CUSTOMER_UPDATED",
      userId,
      organizationId,
      metadata: { customerId },
      ...meta,
    });

    return customer;
  }

  private async getOwned(customerId: string, organizationId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.organizationId !== organizationId) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
