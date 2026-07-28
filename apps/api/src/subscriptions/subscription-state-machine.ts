import { BadRequestException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";

/**
 * The complete allow-list of subscription status transitions. Every
 * lifecycle operation must go through {@link assertTransition} before
 * writing a new status - there is no code path that sets `status` directly
 * without checking this map first.
 */
const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  INCOMPLETE: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
  TRIALING: [
    SubscriptionStatus.ACTIVE, // trial converted
    SubscriptionStatus.CANCELED, // trial canceled
    SubscriptionStatus.EXPIRED, // trial expired without conversion
    SubscriptionStatus.SUSPENDED,
  ],
  ACTIVE: [
    SubscriptionStatus.ACTIVE, // renew / upgrade / downgrade / interval / seats - self-transition
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.PAUSED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  PAST_DUE: [
    SubscriptionStatus.ACTIVE, // payment recovered
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  GRACE_PERIOD: [
    SubscriptionStatus.ACTIVE, // recovered within grace period
    SubscriptionStatus.EXPIRED, // grace period elapsed
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  PAUSED: [
    SubscriptionStatus.ACTIVE, // resumed
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.SUSPENDED,
  ],
  CANCELED: [
    SubscriptionStatus.ACTIVE, // resumed before period end (cancelAtPeriodEnd undo)
  ],
  EXPIRED: [],
  SUSPENDED: [
    SubscriptionStatus.ACTIVE, // reactivated
    SubscriptionStatus.CANCELED,
  ],
};

export function isTransitionAllowed(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) {
    // Only ACTIVE self-transitions (renew/upgrade/downgrade/etc.) are
    // meaningful; every other status is a no-op that should be rejected
    // rather than silently succeeding.
    return from === SubscriptionStatus.ACTIVE;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throws if the transition is not allowed; otherwise returns normally. */
export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new BadRequestException(`Invalid subscription state transition: ${from} -> ${to}`);
  }
}
