import type { HttpClient } from "./client";
import type { EntitlementCheckResult, UsageSnapshot } from "./types";

/**
 * Wraps `apps/api/src/entitlements/public-runtime.controller.ts`
 * (`/public/runtime/entitlements/*`) - the "can this customer do X" checks
 * an integrating app calls at runtime. Requires an application-scoped API
 * key (an org-only key without an application will get a 400 from the API).
 */
export class EntitlementsClient {
  constructor(private readonly http: HttpClient) {}

  /** Is this entitlement key allowed for your application right now? */
  check(key: string): Promise<EntitlementCheckResult> {
    return this.http.request<EntitlementCheckResult>(
      "GET",
      `/public/runtime/entitlements/${encodeURIComponent(key)}`,
    );
  }

  /** Current usage/limit/remaining for a metered entitlement key. */
  getUsage(key: string): Promise<UsageSnapshot> {
    return this.http.request<UsageSnapshot>(
      "GET",
      `/public/runtime/entitlements/${encodeURIComponent(key)}/usage`,
    );
  }

  /** Records usage against a metered entitlement key. Throws `SdkApiError` (403) if this would exceed the limit. */
  incrementUsage(key: string, amount = 1): Promise<UsageSnapshot> {
    return this.http.request<UsageSnapshot>(
      "POST",
      `/public/runtime/entitlements/${encodeURIComponent(key)}/increment`,
      { amount },
    );
  }

  /** Reverses previously recorded usage (e.g. a refund, an undone action). Floors at zero. */
  decrementUsage(key: string, amount = 1): Promise<{ success: true }> {
    return this.http.request<{ success: true }>(
      "POST",
      `/public/runtime/entitlements/${encodeURIComponent(key)}/decrement`,
      { amount },
    );
  }
}
