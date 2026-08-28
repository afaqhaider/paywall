import type { HttpClient } from "./client";
import type {
  Plan,
  CreateCheckoutIntentInput,
  CreateCheckoutIntentResult,
  CheckoutIntentDetail,
  CheckoutSession,
} from "./types";

/**
 * Wraps `apps/api/src/payments/public/public-catalog.controller.ts` and
 * `public-checkout-intents.controller.ts` - the "embed our checkout"
 * flow. `listPlans` and `createIntent` are called from YOUR backend (they
 * need your API key); `getIntent`/`completeIntent` are called from the
 * customer's own browser on your hosted checkout page (no API key - the
 * intent id itself is the short-lived, single-use capability), so those two
 * also work with an `HttpClient` that has no `apiKey` set, as long as
 * `baseUrl` is configured. This class doesn't enforce that distinction;
 * it's on you not to leak your API key into a page the customer's browser
 * loads.
 *
 * NOT AVAILABLE AGAINST THIS REPO'S API: `payments/public/*` was built for
 * (and deliberately kept exclusive to) the `marketplace` fork - this repo's
 * `apps/api` has no `/public/plans` or `/checkout-intents` routes, so these
 * methods will 404 here. Included anyway because the SDK is meant to work
 * against either deployment (point `baseUrl` at whichever has the routes);
 * this class is simply inert against a `paywall` `apps/api` until/unless
 * that feature is added here too.
 */
export class CheckoutClient {
  constructor(private readonly http: HttpClient) {}

  /** Active plans (with active prices) visible to your API key's organization/application. */
  listPlans(): Promise<Plan[]> {
    return this.http.request<Plan[]>("GET", "/public/plans");
  }

  /** Starts a checkout for a specific customer email + plan/price. Returns an intent id to redirect the customer to. */
  createIntent(input: CreateCheckoutIntentInput): Promise<CreateCheckoutIntentResult> {
    return this.http.request<CreateCheckoutIntentResult>("POST", "/checkout-intents", input);
  }

  /** Fetches an intent + the available payment providers to render on your hosted checkout page. */
  getIntent(intentId: string): Promise<CheckoutIntentDetail> {
    return this.http.request<CheckoutIntentDetail>(
      "GET",
      `/checkout-intents/${encodeURIComponent(intentId)}`,
    );
  }

  /** Customer picked a provider - completes the intent and returns the resulting checkout session. */
  completeIntent(intentId: string, providerId: string): Promise<CheckoutSession> {
    return this.http.request<CheckoutSession>(
      "POST",
      `/checkout-intents/${encodeURIComponent(intentId)}/complete`,
      { providerId },
    );
  }
}
