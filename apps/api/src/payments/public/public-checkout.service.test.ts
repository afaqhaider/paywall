import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PublicCheckoutService } from "./public-checkout.service";

function buildPrismaMock() {
  return {
    plan: { findMany: vi.fn(), findUnique: vi.fn() },
    price: { findUnique: vi.fn() },
    checkoutIntent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    paymentProvider: { findMany: vi.fn(), findUnique: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn() },
  };
}

const apiKeyContext = {
  apiKeyId: "key-1",
  apiClientId: "client-1",
  organizationId: "org-1",
  applicationId: "app-1",
  scopes: [],
};

describe("PublicCheckoutService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { record: ReturnType<typeof vi.fn> };
  let systemActor: { getSystemUserId: ReturnType<typeof vi.fn> };
  let checkoutService: { create: ReturnType<typeof vi.fn> };
  let service: PublicCheckoutService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { record: vi.fn() };
    systemActor = { getSystemUserId: vi.fn().mockResolvedValue("system-user-1") };
    checkoutService = { create: vi.fn() };
    service = new PublicCheckoutService(
      prisma as never,
      auditService as never,
      systemActor as never,
      checkoutService as never,
    );
  });

  describe("listPlans", () => {
    it("scopes the query to the API key's organization and application", async () => {
      prisma.plan.findMany.mockResolvedValueOnce([]);

      await service.listPlans(apiKeyContext);

      expect(prisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
            product: { organizationId: "org-1", applicationId: "app-1" },
          }),
        }),
      );
    });
  });

  describe("createIntent", () => {
    it("rejects a plan belonging to a different organization", async () => {
      prisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-1",
        product: { organizationId: "other-org" },
      });

      await expect(
        service.createIntent(apiKeyContext, {
          customerEmail: "buyer@example.com",
          planId: "plan-1",
          priceId: "price-1",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a price that doesn't belong to the given plan", async () => {
      prisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-1",
        product: { organizationId: "org-1" },
      });
      prisma.price.findUnique.mockResolvedValueOnce({ id: "price-1", planId: "some-other-plan" });

      await expect(
        service.createIntent(apiKeyContext, {
          customerEmail: "buyer@example.com",
          planId: "plan-1",
          priceId: "price-1",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("creates an intent scoped to the org/app from the API key", async () => {
      prisma.plan.findUnique.mockResolvedValueOnce({
        id: "plan-1",
        product: { organizationId: "org-1" },
      });
      prisma.price.findUnique.mockResolvedValueOnce({ id: "price-1", planId: "plan-1" });
      prisma.checkoutIntent.create.mockResolvedValueOnce({ id: "intent-1", expiresAt: new Date() });

      await service.createIntent(apiKeyContext, {
        customerEmail: "buyer@example.com",
        planId: "plan-1",
        priceId: "price-1",
      });

      expect(prisma.checkoutIntent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "org-1",
            applicationId: "app-1",
            customerEmail: "buyer@example.com",
            planId: "plan-1",
            priceId: "price-1",
          }),
        }),
      );
    });
  });

  describe("getIntent", () => {
    it("throws when the intent doesn't exist", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce(null);
      await expect(service.getIntent("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws when the intent has expired", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.getIntent("intent-1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws when the intent was already completed", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        status: "COMPLETED",
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      await expect(service.getIntent("intent-1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("returns the intent with active providers for its organization", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        id: "intent-1",
        organizationId: "org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      prisma.paymentProvider.findMany.mockResolvedValueOnce([{ id: "prov-1", type: "STRIPE" }]);

      const result = await service.getIntent("intent-1");

      expect(result.providers).toEqual([{ id: "prov-1", type: "STRIPE" }]);
      expect(prisma.paymentProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-1" }) }),
      );
    });
  });

  describe("completeIntent", () => {
    const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

    it("throws when the intent is no longer pending", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        status: "COMPLETED",
        expiresAt: new Date(Date.now() + 1_000_000),
      });

      await expect(service.completeIntent("intent-1", "prov-1", meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("throws when the provider doesn't belong to the intent's organization", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        id: "intent-1",
        organizationId: "org-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      prisma.paymentProvider.findUnique.mockResolvedValueOnce({
        id: "prov-1",
        organizationId: "other-org",
      });

      await expect(service.completeIntent("intent-1", "prov-1", meta)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("finds-or-creates the customer by email and delegates to CheckoutService", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        id: "intent-1",
        organizationId: "org-1",
        applicationId: "app-1",
        customerEmail: "buyer@example.com",
        planId: "plan-1",
        priceId: "price-1",
        successUrl: null,
        cancelUrl: null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      prisma.paymentProvider.findUnique.mockResolvedValueOnce({
        id: "prov-1",
        organizationId: "org-1",
      });
      prisma.customer.findFirst.mockResolvedValueOnce(null);
      prisma.customer.create.mockResolvedValueOnce({ id: "cust-new" });
      checkoutService.create.mockResolvedValueOnce({ id: "session-1", checkoutUrl: "https://pay" });

      const result = await service.completeIntent("intent-1", "prov-1", meta);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: "org-1", email: "buyer@example.com" }),
        }),
      );
      expect(checkoutService.create).toHaveBeenCalledWith(
        "org-1",
        "system-user-1",
        expect.objectContaining({
          providerId: "prov-1",
          customerId: "cust-new",
          priceId: "price-1",
        }),
        meta,
      );
      expect(prisma.checkoutIntent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "intent-1" },
          data: expect.objectContaining({ status: "COMPLETED", checkoutSessionId: "session-1" }),
        }),
      );
      expect(result).toEqual({ id: "session-1", checkoutUrl: "https://pay" });
    });

    it("reuses an existing customer by email instead of creating a duplicate", async () => {
      prisma.checkoutIntent.findUnique.mockResolvedValueOnce({
        id: "intent-1",
        organizationId: "org-1",
        applicationId: "app-1",
        customerEmail: "buyer@example.com",
        planId: "plan-1",
        priceId: "price-1",
        successUrl: null,
        cancelUrl: null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 1_000_000),
      });
      prisma.paymentProvider.findUnique.mockResolvedValueOnce({
        id: "prov-1",
        organizationId: "org-1",
      });
      prisma.customer.findFirst.mockResolvedValueOnce({ id: "cust-existing" });
      checkoutService.create.mockResolvedValueOnce({ id: "session-1", checkoutUrl: "https://pay" });

      await service.completeIntent("intent-1", "prov-1", meta);

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(checkoutService.create).toHaveBeenCalledWith(
        "org-1",
        "system-user-1",
        expect.objectContaining({ customerId: "cust-existing" }),
        meta,
      );
    });
  });
});
