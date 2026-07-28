import { Injectable, NotFoundException } from "@nestjs/common";
import {
  FinancialProviderType,
  PaymentDisputeStatus,
  PaymentInvoiceStatus,
  PaymentTransactionStatus,
  type FinancialEvent,
  type FinancialSync,
  type PaymentDispute,
  type PaymentInvoice,
  type PaymentReceipt,
  type PaymentRefund,
  type PaymentTransaction,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import { CustomerOwnershipService } from "./customer-ownership.service";
import type { FinancialListQueryDto } from "./dto/financial-list-query.dto";
import type { TransactionListQueryDto } from "./dto/transaction-list-query.dto";

type SyncWithEvent = FinancialSync & { financialEvent: FinancialEvent };

/**
 * Dual-mode read layer over Phase 5 (payments) and Phase 8 (financial sync):
 *
 *  - INTERNAL mode (no `FinancialIntegration` row, or `provider ===
 *    "INTERNAL"`): reads `PaymentInvoice`/`PaymentReceipt` directly - Phase
 *    5's existing tables, read-only here, never written to.
 *  - LEDGIX_ERP mode: reads the sync engine's CACHED `FinancialSync` rows
 *    (`erpInvoiceId`/`erpReceiptId`/`erpReferenceNumber` +
 *    `financialEvent.payload`) rather than calling the ERP connector live.
 *    A live per-request external HTTP call from a customer-facing list
 *    endpoint would violate the "don't block" / "scale to millions of
 *    users" guidance this platform is built around - true on-demand ERP
 *    querying is a possible future enhancement, not implemented here.
 *
 * `PaymentTransaction` is always read directly regardless of provider mode -
 * transactions are tracked internally by Phase 5's design in every case.
 */
@Injectable()
export class CustomerFinancialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: CustomerOwnershipService,
  ) {}

  async listInvoices(customerId: string, userId: string, query: FinancialListQueryDto) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    const limit = normalizePageSize(query.limit);
    const mode = await this.resolveMode(customer.organizationId);

    if (mode === FinancialProviderType.INTERNAL) {
      const cursorWhere = buildCursorWhereClause(query.cursor);
      const status = asEnumOrUndefined(PaymentInvoiceStatus, query.status);

      const rows = await this.prisma.paymentInvoice.findMany({
        where: {
          customerId,
          ...(status ? { status } : {}),
          ...(query.search ? { providerInvoiceId: { contains: query.search } } : {}),
          ...(cursorWhere ?? {}),
        },
        orderBy: CURSOR_ORDER_BY,
        take: limit + 1,
      });
      const page = paginateResults(rows, limit);
      return { ...page, source: "INTERNAL" as const, items: page.items.map(mapInternalInvoice) };
    }

    const cursorWhere = buildCursorWhereClause(query.cursor);
    const rows = await this.prisma.financialSync.findMany({
      where: {
        financialEvent: { customerId },
        erpInvoiceId: { not: null },
        ...(query.search ? { erpReferenceNumber: { contains: query.search } } : {}),
        ...(cursorWhere ?? {}),
      },
      include: { financialEvent: true },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });
    const page = paginateResults(rows, limit);
    return { ...page, source: "LEDGIX_ERP" as const, items: page.items.map(mapErpInvoice) };
  }

  async downloadInvoice(customerId: string, invoiceId: string, userId: string) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    const mode = await this.resolveMode(customer.organizationId);

    if (mode === FinancialProviderType.INTERNAL) {
      const invoice = await this.prisma.paymentInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.customerId !== customerId) {
        throw new NotFoundException("Invoice not found");
      }
      // PaymentInvoice has no PDF/url field in this schema - an honest
      // placeholder rather than a fabricated document.
      return {
        message: "PDF generation not yet implemented for internal invoices",
        invoice: mapInternalInvoice(invoice),
      };
    }

    const sync = await this.prisma.financialSync.findUnique({
      where: { id: invoiceId },
      include: { financialEvent: true },
    });
    if (!sync || sync.financialEvent.customerId !== customerId) {
      throw new NotFoundException("Invoice not found");
    }
    const url = extractUrl(sync.financialEvent.payload);
    if (url) {
      return { url };
    }
    return {
      message: "PDF generation not yet implemented for internal invoices",
      invoice: mapErpInvoice(sync),
    };
  }

  async listReceipts(customerId: string, userId: string, query: FinancialListQueryDto) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    const limit = normalizePageSize(query.limit);
    const mode = await this.resolveMode(customer.organizationId);

    if (mode === FinancialProviderType.INTERNAL) {
      const cursorWhere = buildCursorWhereClause(query.cursor);
      const rows = await this.prisma.paymentReceipt.findMany({
        where: {
          transaction: { customerId },
          ...(query.search ? { receiptNumber: { contains: query.search } } : {}),
          ...(cursorWhere ?? {}),
        },
        orderBy: CURSOR_ORDER_BY,
        take: limit + 1,
      });
      const page = paginateResults(rows, limit);
      return { ...page, source: "INTERNAL" as const, items: page.items.map(mapInternalReceipt) };
    }

    const cursorWhere = buildCursorWhereClause(query.cursor);
    const rows = await this.prisma.financialSync.findMany({
      where: {
        financialEvent: { customerId },
        erpReceiptId: { not: null },
        ...(query.search ? { erpReferenceNumber: { contains: query.search } } : {}),
        ...(cursorWhere ?? {}),
      },
      include: { financialEvent: true },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });
    const page = paginateResults(rows, limit);
    return { ...page, source: "LEDGIX_ERP" as const, items: page.items.map(mapErpReceipt) };
  }

  async listTransactions(customerId: string, userId: string, query: TransactionListQueryDto) {
    await this.ownership.loadOwnedCustomer(customerId, userId);
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);
    const status = asEnumOrUndefined(PaymentTransactionStatus, query.status);

    const rows = await this.prisma.paymentTransaction.findMany({
      where: {
        customerId,
        ...(status ? { status } : {}),
        ...(cursorWhere ?? {}),
      },
      include: { refunds: true, disputes: true },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });
    const page = paginateResults(rows, limit);

    // Best-effort transaction -> sync linkage via a shared subscriptionId -
    // exact 1:1 transaction-to-sync mapping isn't modeled in this schema, so
    // this is an approximation (null when not linkable), not a guaranteed join.
    const subscriptionIds = [
      ...new Set(page.items.map((t) => t.subscriptionId).filter((id): id is string => !!id)),
    ];
    const syncs = subscriptionIds.length
      ? await this.prisma.financialSync.findMany({
          where: { financialEvent: { subscriptionId: { in: subscriptionIds } } },
          include: { financialEvent: true },
        })
      : [];
    const syncBySubscription = new Map(
      syncs
        .filter((s) => s.financialEvent.subscriptionId)
        .map((s) => [s.financialEvent.subscriptionId as string, s]),
    );

    return {
      ...page,
      items: page.items.map((t) =>
        mapTransaction(t, t.subscriptionId ? syncBySubscription.get(t.subscriptionId) : undefined),
      ),
    };
  }

  private async resolveMode(organizationId: string): Promise<FinancialProviderType> {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId },
    });
    return integration?.provider ?? FinancialProviderType.INTERNAL;
  }
}

function mapInternalInvoice(invoice: PaymentInvoice) {
  return {
    id: invoice.id,
    source: "INTERNAL" as const,
    status: invoice.status,
    amountDueMinor: invoice.amountDueMinor,
    amountPaidMinor: invoice.amountPaidMinor,
    currency: invoice.currency,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
  };
}

function mapErpInvoice(sync: SyncWithEvent) {
  return {
    id: sync.id,
    source: "LEDGIX_ERP" as const,
    erpInvoiceId: sync.erpInvoiceId,
    erpReferenceNumber: sync.erpReferenceNumber,
    status: sync.status,
    payload: sync.financialEvent.payload,
    createdAt: sync.createdAt,
  };
}

function mapInternalReceipt(receipt: PaymentReceipt) {
  return {
    id: receipt.id,
    source: "INTERNAL" as const,
    receiptNumber: receipt.receiptNumber,
    url: receipt.url,
    issuedAt: receipt.issuedAt,
    createdAt: receipt.createdAt,
  };
}

function mapErpReceipt(sync: SyncWithEvent) {
  return {
    id: sync.id,
    source: "LEDGIX_ERP" as const,
    erpReceiptId: sync.erpReceiptId,
    erpReferenceNumber: sync.erpReferenceNumber,
    status: sync.status,
    payload: sync.financialEvent.payload,
    createdAt: sync.createdAt,
  };
}

function mapTransaction(
  transaction: PaymentTransaction & { refunds: PaymentRefund[]; disputes: PaymentDispute[] },
  sync?: SyncWithEvent,
) {
  return {
    id: transaction.id,
    status: transaction.status,
    label: deriveLabel(transaction),
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    subscriptionId: transaction.subscriptionId,
    createdAt: transaction.createdAt,
    refunds: transaction.refunds,
    disputes: transaction.disputes,
    // Best-effort - see `listTransactions` for the approximation this relies on.
    syncStatus: sync?.status ?? null,
    erpReferenceNumber: sync?.erpReferenceNumber ?? null,
  };
}

/** Maps a transaction's raw status/refunds/disputes onto the spec's customer-facing labels (Successful/Pending/Failed/Refunds/Chargebacks/Credits) - a read-time projection, no new stored field. */
function deriveLabel(
  transaction: PaymentTransaction & { refunds: PaymentRefund[]; disputes: PaymentDispute[] },
): string {
  if (
    transaction.disputes.some(
      (d) =>
        d.status === PaymentDisputeStatus.OPEN || d.status === PaymentDisputeStatus.UNDER_REVIEW,
    )
  ) {
    return "Chargeback";
  }
  if (transaction.status === PaymentTransactionStatus.PARTIALLY_REFUNDED) {
    return "Credit";
  }
  if (transaction.refunds.length > 0 || transaction.status === PaymentTransactionStatus.REFUNDED) {
    return "Refund";
  }
  switch (transaction.status) {
    case PaymentTransactionStatus.SUCCEEDED:
    case PaymentTransactionStatus.CAPTURED:
      return "Successful";
    case PaymentTransactionStatus.PENDING:
    case PaymentTransactionStatus.AUTHORIZED:
      return "Pending";
    case PaymentTransactionStatus.FAILED:
    case PaymentTransactionStatus.CANCELED:
      return "Failed";
    default:
      return transaction.status;
  }
}

function extractUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["url", "invoiceUrl", "pdfUrl", "documentUrl"]) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function asEnumOrUndefined<T extends Record<string, string>>(
  enumObject: T,
  value: string | undefined,
): T[keyof T] | undefined {
  if (!value) return undefined;
  return (Object.values(enumObject) as string[]).includes(value)
    ? (value as T[keyof T])
    : undefined;
}
