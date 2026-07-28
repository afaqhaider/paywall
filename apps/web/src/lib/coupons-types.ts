export type CouponDiscountType = "FIXED" | "PERCENTAGE";
export type CouponDuration = "ONCE" | "REPEATING" | "FOREVER";
export type CouponStatus = "ACTIVE" | "ARCHIVED" | "EXPIRED";

export interface Coupon {
  id: string;
  organizationId: string;
  code: string;
  name: string | null;
  discountType: CouponDiscountType;
  amountOffMinor: number | null;
  percentOff: number | null;
  currency: string | null;
  duration: CouponDuration;
  durationInCycles: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  productId: string | null;
  planId: string | null;
  expiresAt: string | null;
  status: CouponStatus;
  metadata: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionCode {
  id: string;
  couponId: string;
  code: string;
  active: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  customerId: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCoupon {
  id: string;
  subscriptionId: string;
  couponId: string;
  promotionCodeId: string | null;
  customerId: string;
  appliedAt: string;
  endsAt: string | null;
  removedAt: string | null;
  createdAt: string;
}

export const COUPON_DISCOUNT_TYPES: CouponDiscountType[] = ["FIXED", "PERCENTAGE"];
export const COUPON_DURATIONS: CouponDuration[] = ["ONCE", "REPEATING", "FOREVER"];
export const COUPON_STATUSES: CouponStatus[] = ["ACTIVE", "ARCHIVED", "EXPIRED"];
