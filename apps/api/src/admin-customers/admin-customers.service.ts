import { Injectable, NotFoundException } from "@nestjs/common";
import { CustomerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { AdminCustomerQueryDto } from "./dto/admin-customer-query.dto";

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminCustomerQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.customer.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(cursorWhere ?? {}),
      },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    const page = paginateResults(rows, limit);
    return {
      ...page,
      items: page.items.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        email: c.email,
        status: c.status,
        organizationId: c.organizationId,
        organizationName: c.organization.name,
        applicationId: c.applicationId,
        createdAt: c.createdAt,
      })),
    };
  }

  /**
   * Profile + everything Support needs in one call. License and financial
   * sync joins mirror Phase 8's customer-portal resolution exactly
   * (`customer-licenses.service.ts` / `customer-financials.service.ts`) -
   * this is the same ambiguity (License has no direct `customerId`;
   * FinancialSync's customer link goes through FinancialEvent), resolved
   * the same way here rather than reinvented.
   */
  async getOne(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        organization: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
        subscriptions: { orderBy: { createdAt: "desc" } },
        paymentInvoices: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const linkedUserId = customer.userId;
    const assignmentFilter = linkedUserId ?? "__no_linked_user__";

    const [licenses, deviceRegistrations, receipts, financialSyncs] = await Promise.all([
      this.prisma.license.findMany({
        where: {
          OR: [
            { subscription: { customerId } },
            ...(linkedUserId
              ? [
                  { assignments: { some: { userId: linkedUserId } } },
                  { seats: { some: { assignments: { some: { userId: linkedUserId } } } } },
                ]
              : []),
          ],
        },
        include: {
          assignments: { where: { userId: assignmentFilter } },
          seats: { include: { assignments: { where: { userId: assignmentFilter } } } },
          licenseKeys: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      linkedUserId
        ? this.prisma.deviceRegistration.findMany({
            where: { userId: linkedUserId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      this.prisma.paymentReceipt.findMany({
        where: { transaction: { customerId } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financialSync.findMany({
        where: { financialEvent: { customerId } },
        include: { financialEvent: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      id: customer.id,
      type: customer.type,
      status: customer.status,
      suspendedAt: customer.suspendedAt,
      displayName: customer.displayName,
      email: customer.email,
      userId: customer.userId,
      organization: customer.organization,
      application: customer.application,
      createdAt: customer.createdAt,
      subscriptions: customer.subscriptions,
      licenses,
      deviceRegistrations,
      paymentInvoices: customer.paymentInvoices,
      paymentReceipts: receipts,
      financialSyncStatus: financialSyncs.map((s) => ({
        id: s.id,
        status: s.status,
        erpReferenceNumber: s.erpReferenceNumber,
        eventType: s.financialEvent.type,
        createdAt: s.createdAt,
      })),
    };
  }

  async suspend(customerId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(customerId);

    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: CustomerStatus.SUSPENDED, suspendedAt: new Date() },
    });

    await this.auditService.record({
      action: "CUSTOMER_SUSPENDED",
      userId: adminUserId,
      organizationId: customer.organizationId,
      metadata: { customerId },
      ...meta,
    });

    return customer;
  }

  async reactivate(customerId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(customerId);

    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: CustomerStatus.ACTIVE, suspendedAt: null },
    });

    await this.auditService.record({
      action: "CUSTOMER_REACTIVATED",
      userId: adminUserId,
      organizationId: customer.organizationId,
      metadata: { customerId },
      ...meta,
    });

    return customer;
  }

  private async getOrThrow(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
