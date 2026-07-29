import { describe, expect, it } from "vitest";
import { computeCommissionSplit, reverseCommissionSplit } from "./commission-calculator.util";

describe("computeCommissionSplit", () => {
  it("splits a gross amount by percentage rate", () => {
    const split = computeCommissionSplit(10_000, { ratePercent: 15, flatFeeMinor: 0 });
    expect(split).toEqual({
      grossAmountMinor: 10_000,
      commissionAmountMinor: 1_500,
      vendorPayoutAmountMinor: 8_500,
    });
  });

  it("adds a flat fee on top of the percentage", () => {
    const split = computeCommissionSplit(10_000, { ratePercent: 10, flatFeeMinor: 100 });
    expect(split.commissionAmountMinor).toBe(1_100);
    expect(split.vendorPayoutAmountMinor).toBe(8_900);
  });

  it("rounds the percentage portion to the nearest minor unit", () => {
    const split = computeCommissionSplit(999, { ratePercent: 15, flatFeeMinor: 0 });
    // 999 * 0.15 = 149.85 -> rounds to 150
    expect(split.commissionAmountMinor).toBe(150);
    expect(split.vendorPayoutAmountMinor).toBe(849);
  });

  it("clamps commission at the gross amount so payout never goes negative", () => {
    const split = computeCommissionSplit(500, { ratePercent: 50, flatFeeMinor: 1_000 });
    expect(split.commissionAmountMinor).toBe(500);
    expect(split.vendorPayoutAmountMinor).toBe(0);
  });

  it("handles a zero-rate rule (flat fee only)", () => {
    const split = computeCommissionSplit(5_000, { ratePercent: 0, flatFeeMinor: 200 });
    expect(split.commissionAmountMinor).toBe(200);
    expect(split.vendorPayoutAmountMinor).toBe(4_800);
  });

  it("rejects a negative gross amount", () => {
    expect(() => computeCommissionSplit(-1, { ratePercent: 10, flatFeeMinor: 0 })).toThrow();
  });
});

describe("reverseCommissionSplit", () => {
  it("negates every field of a split", () => {
    const split = computeCommissionSplit(10_000, { ratePercent: 15, flatFeeMinor: 0 });
    expect(reverseCommissionSplit(split)).toEqual({
      grossAmountMinor: -10_000,
      commissionAmountMinor: -1_500,
      vendorPayoutAmountMinor: -8_500,
    });
  });
});
