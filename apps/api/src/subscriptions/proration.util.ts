const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProrationInput {
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  /** What the current period already costs at the old price/quantity. */
  oldAmountMinor: number;
  /** What the current period would cost at the new price/quantity. */
  newAmountMinor: number;
}

export interface ProrationResult {
  /** Credit for the unused portion of the old price - integer minor units. */
  creditMinor: number;
  /** Charge for the remaining portion at the new price - integer minor units. */
  chargeMinor: number;
  /** chargeMinor - creditMinor. Positive = customer owes more; negative = customer is credited. */
  netMinor: number;
  remainingDays: number;
  totalDays: number;
}

/**
 * Day-based, provider-independent proration. Calculates the expected
 * adjustment for an immediate change (upgrade, downgrade, seat change,
 * interval change) - it never collects or moves money, only computes and
 * returns integer minor-unit amounts for the caller to persist as a
 * ProrationRecord.
 */
export function calculateProration(input: ProrationInput): ProrationResult {
  const { periodStart, periodEnd, now, oldAmountMinor, newAmountMinor } = input;

  const totalMs = Math.max(MS_PER_DAY, periodEnd.getTime() - periodStart.getTime());
  const remainingMs = Math.min(totalMs, Math.max(0, periodEnd.getTime() - now.getTime()));

  const totalDays = Math.max(1, Math.round(totalMs / MS_PER_DAY));
  const remainingDays = Math.min(totalDays, Math.round(remainingMs / MS_PER_DAY));

  const remainingFraction = remainingDays / totalDays;

  const creditMinor = Math.round(oldAmountMinor * remainingFraction);
  const chargeMinor = Math.round(newAmountMinor * remainingFraction);

  return {
    creditMinor,
    chargeMinor,
    netMinor: chargeMinor - creditMinor,
    remainingDays,
    totalDays,
  };
}
