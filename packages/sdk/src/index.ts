import { HttpClient, type PaywallClientConfig } from "./client";
import { CheckoutClient } from "./checkout";
import { EntitlementsClient } from "./entitlements";
import { LicenseKeysClient } from "./licenses";
import { DevicesClient } from "./devices";

/**
 * Server-side SDK for integrating against the SSCodeAxis API.
 * See README.md for a quickstart and the "External requirements" section
 * for what needs to be filled in (API base URL, API key) before this can
 * talk to a real deployment.
 *
 * ```ts
 * const sdk = new PaywallSDK({ apiKey: process.env.PLATFORM_API_KEY!, baseUrl: process.env.PLATFORM_API_URL! });
 * const { id } = await sdk.checkout.createIntent({ customerEmail, planId, priceId });
 * // redirect the customer to your hosted checkout page with `id`
 * ```
 */
export class PaywallSDK {
  readonly checkout: CheckoutClient;
  readonly entitlements: EntitlementsClient;
  readonly licenseKeys: LicenseKeysClient;
  readonly devices: DevicesClient;

  constructor(config: PaywallClientConfig) {
    const http = new HttpClient(config);
    this.checkout = new CheckoutClient(http);
    this.entitlements = new EntitlementsClient(http);
    this.licenseKeys = new LicenseKeysClient(http);
    this.devices = new DevicesClient(http);
  }
}

export type { PaywallClientConfig } from "./client";
export { SdkApiError, SdkConfigError } from "./errors";
export { constructWebhookEvent } from "./webhooks";
export type { WebhookEvent } from "./webhooks";
export * from "./types";
