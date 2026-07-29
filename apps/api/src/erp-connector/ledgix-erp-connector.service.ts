import { Injectable, Logger } from "@nestjs/common";
import type { ERPConnectionCredentials } from "./erp-connection-credentials.interface";

/**
 * ============================================================================
 * Assumed LedGix ERP REST API shape
 * ============================================================================
 * No real LedGix instance exists in this environment to verify against, so
 * this is a documented assumption - a real, working HTTP client whose target
 * happens to be unreachable in this sandbox, the same way this repo's other
 * external payment provider adapters are written against a documented
 * contract. If a real LedGix spec later diverges, only the private
 * `map*Request`/`map*Response` functions below and the constants at the top
 * of this file should need to change - the public method surface is the
 * stable contract the rest of this codebase depends on.
 *
 * Base URL: every request is built as `${baseUrl}/api/${apiVersion}/<path>`
 * (e.g. `https://erp.example.com/api/v1/invoices`).
 *
 * Authentication: `Authorization: Bearer <apiKey>` on every request. Chosen
 * over an `X-Api-Key` header for consistency with this codebase's other
 * bearer-style integrations. If the sibling `financial-integration` module's
 * lightweight "test connection" ping assumed `X-Api-Key` instead, that is a
 * one-line reconciliation at merge time, not a design disagreement - LedGix
 * itself is documented (by assumption) to accept either header interchangeably.
 *
 * Every request additionally carries:
 *   - `X-Company-Id: <companyId>` - LedGix is multi-company; this scopes the
 *     call to the connection's ledger.
 *   - `Idempotency-Key: <idempotencyKey>` - caller-supplied (this codebase
 *     derives it from the `FinancialSync.id`), the conflict-resolution
 *     mechanism that lets a retried call safely land on a real LedGix without
 *     double-creating an invoice/receipt/payment.
 *
 * POST /api/{version}/invoices
 *   request:  { customerReference: string, amountMinor: number, currency: string, description?: string, taxMinor?: number, discountMinor?: number }
 *   response: { id: string, referenceNumber: string, status: "draft" | "open" }
 *
 * POST /api/{version}/invoices/{erpInvoiceId}/receipts
 *   request:  { amountMinor: number, currency: string }
 *   response: { id: string, referenceNumber: string }
 *
 * POST /api/{version}/receipts/{erpReceiptId}/payments
 *   request:  { method: string, reference?: string }
 *   response: { referenceNumber: string }
 *
 * Any non-2xx response is treated as a failure; the response body (truncated)
 * is folded into the thrown Error's message so callers/logs can see why.
 * ============================================================================
 */

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_HTTP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const RESPONSE_BODY_MAX_LENGTH = 2_000;

export interface CreateInvoiceData {
  customerReference: string;
  amountMinor: number;
  currency: string;
  description?: string;
  /** Always 0 today - no tax engine exists in this platform - carried through so the LedGix payload shape is ready for one. */
  taxMinor?: number;
  /** Best-effort sum of active SubscriptionCoupon discounts at the time this event was recorded. */
  discountMinor?: number;
}

export interface CreateReceiptData {
  erpInvoiceId: string;
  amountMinor: number;
  currency: string;
}

export interface RecordPaymentData {
  erpReceiptId: string;
  method: string;
  reference?: string;
}

interface LedgixInvoiceResponse {
  id: string;
  referenceNumber: string;
  status: string;
}

interface LedgixReceiptResponse {
  id: string;
  referenceNumber: string;
}

interface LedgixPaymentResponse {
  referenceNumber: string;
}

/**
 * The only place in this codebase (besides `financial-integration`'s
 * deliberately separate, lightweight "test connection" ping) allowed to make
 * an outbound HTTP call to LedGix ERP. Never import this outside
 * `erp-connector/` and `financial-events/` - it is not exposed to the
 * Customer Portal, which reads sync state from Prisma instead of calling
 * this live.
 *
 * Kept a pure HTTP client on purpose: it never touches Prisma and never
 * decrypts anything itself - callers pass already-decrypted credentials and
 * are responsible for persisting whatever this returns.
 */
@Injectable()
export class LedgixErpConnectorService {
  private readonly logger = new Logger(LedgixErpConnectorService.name);

  async createInvoice(
    connection: ERPConnectionCredentials,
    data: CreateInvoiceData,
    idempotencyKey: string,
  ): Promise<{ erpInvoiceId: string; referenceNumber: string }> {
    const body = this.mapInvoiceRequest(data);
    const raw = await this.request(connection, "POST", "invoices", body, idempotencyKey);
    const response = this.mapInvoiceResponse(raw);
    return { erpInvoiceId: response.id, referenceNumber: response.referenceNumber };
  }

  async createReceipt(
    connection: ERPConnectionCredentials,
    data: CreateReceiptData,
    idempotencyKey: string,
  ): Promise<{ erpReceiptId: string; referenceNumber: string }> {
    const body = this.mapReceiptRequest(data);
    const raw = await this.request(
      connection,
      "POST",
      `invoices/${data.erpInvoiceId}/receipts`,
      body,
      idempotencyKey,
    );
    const response = this.mapReceiptResponse(raw);
    return { erpReceiptId: response.id, referenceNumber: response.referenceNumber };
  }

  async recordPayment(
    connection: ERPConnectionCredentials,
    data: RecordPaymentData,
    idempotencyKey: string,
  ): Promise<{ referenceNumber: string }> {
    const body = this.mapPaymentRequest(data);
    const raw = await this.request(
      connection,
      "POST",
      `receipts/${data.erpReceiptId}/payments`,
      body,
      idempotencyKey,
    );
    const response = this.mapPaymentResponse(raw);
    return { referenceNumber: response.referenceNumber };
  }

  // ---- mappers: internal shape -> documented LedGix request/response shape ----

  private mapInvoiceRequest(data: CreateInvoiceData): object {
    return {
      customerReference: data.customerReference,
      amountMinor: data.amountMinor,
      currency: data.currency,
      description: data.description,
      taxMinor: data.taxMinor ?? 0,
      discountMinor: data.discountMinor ?? 0,
    };
  }

  private mapInvoiceResponse(raw: unknown): LedgixInvoiceResponse {
    const value = raw as Partial<LedgixInvoiceResponse> | undefined;
    if (!value?.id || !value.referenceNumber) {
      throw new Error("LedGix invoice response missing id/referenceNumber");
    }
    return {
      id: value.id,
      referenceNumber: value.referenceNumber,
      status: value.status ?? "unknown",
    };
  }

  private mapReceiptRequest(data: CreateReceiptData): object {
    return { amountMinor: data.amountMinor, currency: data.currency };
  }

  private mapReceiptResponse(raw: unknown): LedgixReceiptResponse {
    const value = raw as Partial<LedgixReceiptResponse> | undefined;
    if (!value?.id || !value.referenceNumber) {
      throw new Error("LedGix receipt response missing id/referenceNumber");
    }
    return { id: value.id, referenceNumber: value.referenceNumber };
  }

  private mapPaymentRequest(data: RecordPaymentData): object {
    return { method: data.method, reference: data.reference };
  }

  private mapPaymentResponse(raw: unknown): LedgixPaymentResponse {
    const value = raw as Partial<LedgixPaymentResponse> | undefined;
    if (!value?.referenceNumber) {
      throw new Error("LedGix payment response missing referenceNumber");
    }
    return { referenceNumber: value.referenceNumber };
  }

  /**
   * Sends one LedGix request, retrying transient failures (network errors,
   * non-2xx responses) up to `MAX_HTTP_ATTEMPTS` times with a short linear
   * backoff. This is deliberately a short-horizon, within-one-sync-attempt
   * retry - distinct from `financial-events`' own longer-horizon
   * queue-level retry/backoff, which only kicks in once this method has
   * exhausted its own attempts and thrown.
   *
   * Never logs the raw API key - only method, URL, and companyId.
   */
  private async request(
    connection: ERPConnectionCredentials,
    method: "POST",
    path: string,
    body: object,
    idempotencyKey: string,
  ): Promise<unknown> {
    const url = `${connection.baseUrl}/api/${connection.apiVersion}/${path}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_HTTP_ATTEMPTS; attempt++) {
      this.logger.log(
        `LedGix ${method} ${url} (companyId=${connection.companyId}, attempt ${attempt}/${MAX_HTTP_ATTEMPTS})`,
      );

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${connection.apiKey}`,
            "X-Company-Id": connection.companyId,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const text = await response.text().catch(() => "");

        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `LedGix ${method} ${path} failed with status ${response.status}: ${text.slice(0, RESPONSE_BODY_MAX_LENGTH)}`,
          );
        }

        this.logger.log(`LedGix ${method} ${path} succeeded (status ${response.status})`);
        return text ? JSON.parse(text) : {};
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `LedGix ${method} ${path} attempt ${attempt}/${MAX_HTTP_ATTEMPTS} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempt < MAX_HTTP_ATTEMPTS) {
          await this.delay(attempt * RETRY_DELAY_MS);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`LedGix ${method} ${path} failed after ${MAX_HTTP_ATTEMPTS} attempts`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
