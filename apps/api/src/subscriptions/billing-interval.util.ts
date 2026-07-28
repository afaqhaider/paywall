import { BillingInterval } from "@prisma/client";

/** Advances `from` by one billing period of `interval` x `intervalCount`. */
export function addBillingInterval(from: Date, interval: BillingInterval, intervalCount = 1): Date {
  const result = new Date(from);

  switch (interval) {
    case BillingInterval.DAY:
      result.setDate(result.getDate() + intervalCount);
      break;
    case BillingInterval.WEEK:
      result.setDate(result.getDate() + 7 * intervalCount);
      break;
    case BillingInterval.MONTH:
      result.setMonth(result.getMonth() + intervalCount);
      break;
    case BillingInterval.QUARTER:
      result.setMonth(result.getMonth() + 3 * intervalCount);
      break;
    case BillingInterval.SEMIANNUAL:
      result.setMonth(result.getMonth() + 6 * intervalCount);
      break;
    case BillingInterval.YEAR:
      result.setFullYear(result.getFullYear() + intervalCount);
      break;
    case BillingInterval.LIFETIME:
      // No renewal - push far enough out that "current period" never lapses.
      result.setFullYear(result.getFullYear() + 100);
      break;
    case BillingInterval.CUSTOM:
      // Falls back to intervalCount as raw days when the interval itself
      // doesn't map to a calendar unit.
      result.setDate(result.getDate() + intervalCount);
      break;
  }

  return result;
}
