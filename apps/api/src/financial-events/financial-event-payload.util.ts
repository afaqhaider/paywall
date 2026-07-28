import type { Prisma } from "@prisma/client";

/** Fields this engine (and readers like the Customer Portal) expect to
 * find on `FinancialEvent.payload` - a documented assumption about what
 * callers of `FinancialEventsService.record()` put in `payload`, not a
 * Prisma-enforced shape, since `payload` is `Json`. `taxMinor` is always 0
 * in practice (no tax engine exists in this platform) but the field is
 * carried end-to-end so the shape is ready for one. `discountMinor` is a
 * best-effort sum of any active `SubscriptionCoupon` discounts at the time
 * the event was recorded. */
export interface FinancialEventPayloadFields {
  amountMinor?: number;
  currency?: string;
  description?: string;
  customerReference?: string;
  method?: string;
  reference?: string;
  taxMinor?: number;
  discountMinor?: number;
}

export function readPayloadFields(payload: Prisma.JsonValue): FinancialEventPayloadFields {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as FinancialEventPayloadFields;
  }
  return {};
}
