export interface CheckoutIntentPrice {
  id: string;
  amountMinor: number;
  currency: string;
  interval: string;
  intervalCount: number;
}

export interface CheckoutIntentPlan {
  id: string;
  name: string;
  product: { name: string };
}

export interface CheckoutIntentDetail {
  id: string;
  customerEmail: string;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  expiresAt: string;
  plan: CheckoutIntentPlan;
  price: CheckoutIntentPrice;
}

export interface CheckoutIntentProvider {
  id: string;
  type: string;
  displayName: string;
}

export interface GetCheckoutIntentResponse {
  intent: CheckoutIntentDetail;
  providers: CheckoutIntentProvider[];
}

export function formatPrice(price: CheckoutIntentPrice): string {
  const amount = (price.amountMinor / 100).toFixed(2);
  const interval =
    price.intervalCount > 1
      ? `${price.intervalCount} ${price.interval}s`
      : price.interval.toLowerCase();
  return `${amount} ${price.currency} / ${interval}`;
}

/** Stripe is the only provider in this codebase whose hosted checkout page
 * natively offers Apple Pay / Google Pay wallet buttons when enabled on the
 * connected account - no extra code needed here, the wallet buttons are
 * Stripe's own hosted-checkout UI, not something this page renders itself. */
export function providerLabel(provider: CheckoutIntentProvider): string {
  if (provider.type === "STRIPE") {
    return `${provider.displayName} (card, Apple Pay, Google Pay)`;
  }
  return provider.displayName;
}
