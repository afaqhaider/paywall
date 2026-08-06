import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  ERPConnectionStatus,
  FinancialEventType,
  FinancialProviderType,
  SyncStatus,
  type FinancialEvent,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decryptSecret } from "../common/utils/encryption.util";
import { secrets } from "../config/secrets";
import { LedgixErpConnectorService } from "../erp-connector/ledgix-erp-connector.service";
import type { ERPConnectionCredentials } from "../erp-connector/erp-connection-credentials.interface";
import { readPayloadFields } from "./financial-event-payload.util";

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MINUTES = 60;
const SWEEP_INTERVAL_MS = 30_000;
const SWEEP_BATCH_SIZE = 20;

/** Event types that represent a real charge and get a full LedGix
 * invoice -> receipt -> payment chain. Everything else is treated as
 * informational for ERP-sync purposes (see `syncLedgixErp` below for the
 * per-type reasoning) and just recorded as a successful no-op sync. */
const EVENT_TYPES_REQUIRING_ERP_CHARGE: ReadonlySet<FinancialEventType> = new Set([
  FinancialEventType.SUBSCRIPTION_ACTIVATED,
  FinancialEventType.SUBSCRIPTION_RENEWED,
  FinancialEventType.PAYMENT_SUCCEEDED,
]);

interface SyncOutcomeSuccess {
  ok: true;
  erpConnectionId?: string;
  erpInvoiceId?: string;
  erpReceiptId?: string;
  erpReferenceNumber?: string;
  requestSummary?: Prisma.InputJsonValue;
  responseSummary: Prisma.InputJsonValue;
}

interface SyncOutcomeFailure {
  ok: false;
  erpConnectionId?: string;
  error: string;
}

type SyncOutcome = SyncOutcomeSuccess | SyncOutcomeFailure;

/**
 * The queue processor: enqueue -> attempt -> retry-with-backoff ->
 * dead-letter -> manual retry -> periodic sweep, mirroring
 * `WebhookDispatchService`'s shape exactly, just for `FinancialSync` rows
 * instead of `WebhookDelivery` rows.
 *
 * "Never lose financial data" holds structurally: `FinancialEvent` /
 * `SyncQueue` / `FinancialSync` rows are created durably in Postgres before
 * any ERP call is attempted (see `FinancialEventsService.record`), and this
 * service only ever changes `status` on failure/success - it never deletes
 * a `FinancialEvent`, `FinancialSync`, or `SyncQueue` row.
 *
 * "Once ERP returns online synchronize automatically" also falls out of the
 * normal sweep: a `RETRYING`/manually-re-armed `DEAD_LETTER` row is simply
 * re-attempted on schedule, and a fresh `ERPConnection.status` flip back to
 * CONNECTED (owned by the sibling `financial-integration` module's test
 * connection) is picked up the next time this engine looks it up - no
 * special "came back online" detection is needed.
 */
@Injectable()
export class SyncEngineService implements OnModuleInit {
  private readonly logger = new Logger(SyncEngineService.name);
  private sweepHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly connector: LedgixErpConnectorService,
  ) {}

  onModuleInit(): void {
    if (secrets.nodeEnv === "test") {
      return;
    }

    this.sweepHandle = setInterval(() => {
      this.processDue().catch((error: unknown) => {
        this.logger.error(
          "Financial sync sweep failed",
          error instanceof Error ? error.stack : error,
        );
      });
    }, SWEEP_INTERVAL_MS);
    this.sweepHandle.unref?.();
  }

  /** Finds due PENDING/RETRYING `FinancialSync` rows and attempts each, bounded to a small batch per sweep. */
  async processDue(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.financialSync.findMany({
      where: {
        status: { in: [SyncStatus.PENDING, SyncStatus.RETRYING] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: { id: true },
      take: SWEEP_BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    for (const { id } of due) {
      await this.attemptSync(id).catch((error: unknown) => {
        this.logger.error(
          `Sync attempt failed for FinancialSync ${id}`,
          error instanceof Error ? error.stack : error,
        );
      });
    }
  }

  /** Loads a `FinancialSync` and its `FinancialEvent`, resolves it against the
   * configured provider, and records the outcome. Safe to call directly (e.g.
   * right after a manual retry) or from the periodic sweep. */
  async attemptSync(financialSyncId: string): Promise<void> {
    const sync = await this.prisma.financialSync.findUnique({
      where: { id: financialSyncId },
      include: { financialEvent: true },
    });

    if (!sync) {
      return;
    }

    const attemptNumber = sync.attemptCount + 1;

    const outcome: SyncOutcome =
      sync.provider === FinancialProviderType.INTERNAL
        ? this.syncInternal()
        : await this.syncLedgixErp(sync.financialEvent, sync.id).catch(
            (error: unknown): SyncOutcomeFailure => ({
              ok: false,
              error: error instanceof Error ? error.message : "Unknown sync error",
            }),
          );

    if (outcome.ok) {
      await this.prisma.$transaction([
        this.prisma.financialSync.update({
          where: { id: sync.id },
          data: {
            status: SyncStatus.SUCCESS,
            completedAt: new Date(),
            erpConnectionId: outcome.erpConnectionId,
            erpInvoiceId: outcome.erpInvoiceId,
            erpReceiptId: outcome.erpReceiptId,
            erpReferenceNumber: outcome.erpReferenceNumber,
          },
        }),
        this.prisma.syncHistory.create({
          data: {
            financialSyncId: sync.id,
            attemptNumber,
            status: SyncStatus.SUCCESS,
            requestSummary: outcome.requestSummary,
            responseSummary: outcome.responseSummary,
          },
        }),
        ...(outcome.erpConnectionId
          ? [
              this.prisma.eRPConnection.update({
                where: { id: outcome.erpConnectionId },
                data: { lastSyncedAt: new Date() },
              }),
            ]
          : []),
      ]);
      return;
    }

    const exhausted = attemptNumber >= MAX_ATTEMPTS;
    const nextAttemptAt = exhausted ? null : this.computeNextAttemptAt(attemptNumber);
    const finalStatus = exhausted ? SyncStatus.DEAD_LETTER : SyncStatus.RETRYING;

    await this.prisma.$transaction([
      this.prisma.financialSync.update({
        where: { id: sync.id },
        data: {
          status: finalStatus,
          attemptCount: attemptNumber,
          nextAttemptAt,
          erpConnectionId: outcome.erpConnectionId,
        },
      }),
      this.prisma.syncHistory.create({
        data: {
          financialSyncId: sync.id,
          attemptNumber,
          status: finalStatus,
          error: outcome.error,
        },
      }),
      ...(exhausted
        ? [
            this.prisma.syncError.upsert({
              where: { financialSyncId: sync.id },
              create: { financialSyncId: sync.id, error: outcome.error },
              update: {
                error: outcome.error,
                occurredAt: new Date(),
                resolved: false,
                resolvedAt: null,
                resolvedById: null,
              },
            }),
          ]
        : []),
    ]);

    if (exhausted) {
      await this.auditService.record({
        action: "FINANCIAL_SYNC_DEAD_LETTERED",
        organizationId: sync.financialEvent.organizationId,
        metadata: {
          financialSyncId: sync.id,
          financialEventId: sync.financialEventId,
          error: outcome.error,
        },
      });
    }
  }

  /** INTERNAL provider: the platform's own Payment* tables already ARE the
   * record - there is nothing external to sync to, so this is an immediate,
   * synchronous "success". */
  private syncInternal(): SyncOutcomeSuccess {
    return {
      ok: true,
      responseSummary: { note: "internal mode - no external sync required" },
    };
  }

  /**
   * LEDGIX_ERP provider: resolves the org's `ERPConnection` and, depending on
   * `financialEvent.type`, either drives the connector's
   * invoice -> receipt -> payment chain (for event types that represent a
   * real charge, see `EVENT_TYPES_REQUIRING_ERP_CHARGE`) or records a no-op
   * success (for event types with nothing to charge/no connector method
   * yet - `SUBSCRIPTION_CANCELED` is a status change with no monetary
   * artifact, `PAYMENT_FAILED` never took money, and `REFUND_ISSUED` would
   * need a dedicated `recordRefund` connector method that does not exist in
   * this phase's documented LedGix contract - it is deliberately deferred
   * rather than guessed at).
   */
  private async syncLedgixErp(
    financialEvent: FinancialEvent,
    financialSyncId: string,
  ): Promise<SyncOutcome> {
    const integration = await this.prisma.financialIntegration.findUnique({
      where: { organizationId: financialEvent.organizationId },
      include: { erpConnection: true },
    });
    const connectionRow = integration?.erpConnection;

    if (!connectionRow || connectionRow.status !== ERPConnectionStatus.CONNECTED) {
      return { ok: false, error: "ERP not connected" };
    }

    if (!EVENT_TYPES_REQUIRING_ERP_CHARGE.has(financialEvent.type)) {
      return {
        ok: true,
        erpConnectionId: connectionRow.id,
        responseSummary: {
          note: `no ERP call required for event type ${financialEvent.type} (documented simplification)`,
        },
      };
    }

    const credentials: ERPConnectionCredentials = {
      baseUrl: connectionRow.baseUrl,
      companyId: connectionRow.companyId,
      apiVersion: connectionRow.apiVersion,
      apiKey: decryptSecret({
        encryptedValue: connectionRow.encryptedApiKey,
        iv: connectionRow.iv,
        authTag: connectionRow.authTag,
      }),
    };

    const fields = readPayloadFields(financialEvent.payload);
    const amountMinor = fields.amountMinor ?? 0;
    const currency = fields.currency ?? "USD";
    const customerReference =
      fields.customerReference ?? financialEvent.customerId ?? financialEvent.organizationId;

    // Idempotency keys are derived from the `FinancialSync.id` (one per
    // sub-step, since each is a separate LedGix resource) so that if this
    // whole sync attempt is retried by the sweep, a real LedGix would not
    // double-create the invoice/receipt/payment for the parts that already
    // succeeded on a prior attempt.
    const invoice = await this.connector.createInvoice(
      credentials,
      {
        customerReference,
        amountMinor,
        currency,
        description: fields.description,
        taxMinor: fields.taxMinor,
        discountMinor: fields.discountMinor,
      },
      `${financialSyncId}:invoice`,
    );

    const receipt = await this.connector.createReceipt(
      credentials,
      { erpInvoiceId: invoice.erpInvoiceId, amountMinor, currency },
      `${financialSyncId}:receipt`,
    );

    const payment = await this.connector.recordPayment(
      credentials,
      {
        erpReceiptId: receipt.erpReceiptId,
        method: fields.method ?? "unknown",
        reference: fields.reference,
      },
      `${financialSyncId}:payment`,
    );

    return {
      ok: true,
      erpConnectionId: connectionRow.id,
      erpInvoiceId: invoice.erpInvoiceId,
      erpReceiptId: receipt.erpReceiptId,
      erpReferenceNumber: payment.referenceNumber,
      requestSummary: { customerReference, amountMinor, currency },
      responseSummary: {
        invoiceReferenceNumber: invoice.referenceNumber,
        receiptReferenceNumber: receipt.referenceNumber,
        paymentReferenceNumber: payment.referenceNumber,
      },
    };
  }

  private computeNextAttemptAt(attemptNumber: number): Date {
    const backoffMinutes = Math.min(2 ** attemptNumber, MAX_BACKOFF_MINUTES);
    return new Date(Date.now() + backoffMinutes * 60_000);
  }
}
