import { describe, expect, it, vi, beforeEach } from "vitest";
import { CommissionLedgerStatus } from "@prisma/client";
import { CommissionsService } from "./commissions.service";

/**
 * Unit tests against a mocked PrismaService (no real database available in
 * this environment) - exercises the rule-resolution order and the
 * idempotency guard, the two pieces of business logic that live in this
 * service rather than in the pure calculator util (already covered by
 * commission-calculator.util.test.ts).
 */
function buildPrismaMock() {
  return {
    commissionRule: {
      findFirst: vi.fn(),
    },
    commissionLedgerEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe("CommissionsService.resolveRule", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CommissionsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new CommissionsService(prisma as never);
  });

  it("prefers an application-specific rule over org/platform rules", async () => {
    const appRule = { id: "app-rule" };
    prisma.commissionRule.findFirst.mockResolvedValueOnce(appRule);

    const result = await service.resolveRule("org-1", "app-1");

    expect(result).toBe(appRule);
    expect(prisma.commissionRule.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.commissionRule.findFirst.mock.calls[0][0].where).toMatchObject({
      applicationId: "app-1",
    });
  });

  it("falls back to an org-specific rule when no application rule exists", async () => {
    const orgRule = { id: "org-rule" };
    prisma.commissionRule.findFirst
      .mockResolvedValueOnce(null) // app-specific miss
      .mockResolvedValueOnce(orgRule); // org-specific hit

    const result = await service.resolveRule("org-1", "app-1");

    expect(result).toBe(orgRule);
    expect(prisma.commissionRule.findFirst).toHaveBeenCalledTimes(2);
  });

  it("falls back to the platform default when neither app nor org rule exists", async () => {
    const platformRule = { id: "platform-rule" };
    prisma.commissionRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(platformRule);

    const result = await service.resolveRule("org-1", "app-1");

    expect(result).toBe(platformRule);
    expect(prisma.commissionRule.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.commissionRule.findFirst.mock.calls[2][0].where).toMatchObject({
      organizationId: null,
      applicationId: null,
    });
  });

  it("skips the application lookup entirely when no applicationId is given", async () => {
    prisma.commissionRule.findFirst.mockResolvedValueOnce({ id: "org-rule" });

    await service.resolveRule("org-1", null);

    expect(prisma.commissionRule.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.commissionRule.findFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: "org-1",
      applicationId: null,
    });
  });
});

describe("CommissionsService.recordForTransaction", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CommissionsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new CommissionsService(prisma as never);
  });

  it("is idempotent - returns the existing ACCRUED entry without creating a new one", async () => {
    const existing = { id: "existing-entry", status: CommissionLedgerStatus.ACCRUED };
    prisma.commissionLedgerEntry.findFirst.mockResolvedValueOnce(existing);

    const result = await service.recordForTransaction("txn-1", "org-1", null, 10_000, "USD");

    expect(result).toBe(existing);
    expect(prisma.commissionRule.findFirst).not.toHaveBeenCalled();
    expect(prisma.commissionLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("returns null and does not create an entry when no rule is configured", async () => {
    prisma.commissionLedgerEntry.findFirst.mockResolvedValueOnce(null);
    prisma.commissionRule.findFirst.mockResolvedValue(null);

    const result = await service.recordForTransaction("txn-1", "org-1", null, 10_000, "USD");

    expect(result).toBeNull();
    expect(prisma.commissionLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("creates a ledger entry with the resolved rule's split when none exists yet", async () => {
    prisma.commissionLedgerEntry.findFirst.mockResolvedValueOnce(null);
    prisma.commissionRule.findFirst.mockResolvedValueOnce({
      id: "rule-1",
      ratePercent: 10,
      flatFeeMinor: 0,
    });
    prisma.commissionLedgerEntry.create.mockResolvedValueOnce({ id: "new-entry" });

    const result = await service.recordForTransaction("txn-1", "org-1", "app-1", 10_000, "USD");

    expect(result).toEqual({ id: "new-entry" });
    expect(prisma.commissionLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        paymentTransactionId: "txn-1",
        organizationId: "org-1",
        ruleId: "rule-1",
        currency: "USD",
        grossAmountMinor: 10_000,
        commissionAmountMinor: 1_000,
        vendorPayoutAmountMinor: 9_000,
      },
    });
  });
});
