export interface CommissionRuleInput {
  ratePercent: number;
  flatFeeMinor: number;
}

export interface CommissionSplit {
  grossAmountMinor: number;
  commissionAmountMinor: number;
  vendorPayoutAmountMinor: number;
}

/**
 * Pure split math - gross sale amount -> platform commission (rate% + flat
 * fee) -> vendor payout (the remainder). Kept dependency-free so it can be
 * unit-tested without touching Prisma/the ledger tables; the ledger-writing
 * side (checkpoint 3) calls this and persists the result verbatim, it never
 * recomputes the split itself.
 *
 * Rounds the commission to the nearest minor unit (never fractional cents),
 * and clamps the vendor payout at zero so a misconfigured rate/flat fee
 * larger than the sale itself can never produce a negative payout.
 */
export function computeCommissionSplit(
  grossAmountMinor: number,
  rule: CommissionRuleInput,
): CommissionSplit {
  if (grossAmountMinor < 0) {
    throw new Error("grossAmountMinor must not be negative");
  }

  const percentagePortion = Math.round((grossAmountMinor * rule.ratePercent) / 100);
  const commissionAmountMinor = Math.min(
    grossAmountMinor,
    Math.max(0, percentagePortion + rule.flatFeeMinor),
  );
  const vendorPayoutAmountMinor = grossAmountMinor - commissionAmountMinor;

  return { grossAmountMinor, commissionAmountMinor, vendorPayoutAmountMinor };
}

/** Negates a split for a refund/chargeback reversal entry - see
 * `CommissionLedgerEntry.reversalOfId` in schema.prisma for why this is a
 * new linked row rather than mutating the original. */
export function reverseCommissionSplit(split: CommissionSplit): CommissionSplit {
  return {
    grossAmountMinor: -split.grossAmountMinor,
    commissionAmountMinor: -split.commissionAmountMinor,
    vendorPayoutAmountMinor: -split.vendorPayoutAmountMinor,
  };
}
