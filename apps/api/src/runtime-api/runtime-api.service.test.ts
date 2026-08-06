import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { RuntimeAuthorizationService } from "../entitlements/runtime-authorization.service";
import type { ApiKeyRequestContext } from "../common/guards/api-key.guard";
import { RuntimeApiService } from "./runtime-api.service";

function makeCtx(overrides: Partial<ApiKeyRequestContext> = {}): ApiKeyRequestContext {
  return {
    apiKeyId: "key-1",
    apiClientId: "client-1",
    organizationId: "org-1",
    applicationId: "app-1",
    scopes: ["*"],
    ...overrides,
  };
}

describe("RuntimeApiService", () => {
  let service: RuntimeApiService;
  let prisma: {
    application: { findUnique: ReturnType<typeof vi.fn> };
    license: { findUnique: ReturnType<typeof vi.fn> };
  };
  let runtimeAuth: {
    hasEntitlement: ReturnType<typeof vi.fn>;
    getUsage: ReturnType<typeof vi.fn>;
    incrementUsage: ReturnType<typeof vi.fn>;
    decrementUsage: ReturnType<typeof vi.fn>;
    validateLicenseKey: ReturnType<typeof vi.fn>;
    validateSeat: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      application: { findUnique: vi.fn() },
      license: { findUnique: vi.fn() },
    };
    runtimeAuth = {
      hasEntitlement: vi.fn(),
      getUsage: vi.fn(),
      incrementUsage: vi.fn(),
      decrementUsage: vi.fn(),
      validateLicenseKey: vi.fn(),
      validateSeat: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RuntimeApiService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuntimeAuthorizationService, useValue: runtimeAuth },
      ],
    }).compile();

    service = moduleRef.get(RuntimeApiService);
  });

  describe("application resolution", () => {
    it("uses the key's own applicationId and ignores any caller-supplied one", async () => {
      runtimeAuth.hasEntitlement.mockResolvedValue({
        allowed: true,
        numberValue: null,
        textValue: null,
        isUnlimited: true,
      });

      await service.checkEntitlement(makeCtx({ applicationId: "app-1" }), "pro", "some-other-app");

      expect(runtimeAuth.hasEntitlement).toHaveBeenCalledWith("org-1", "app-1", "pro");
      expect(prisma.application.findUnique).not.toHaveBeenCalled();
    });

    it("rejects an org-wide key with no applicationId supplied", async () => {
      await expect(
        service.checkEntitlement(makeCtx({ applicationId: null }), "pro"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an org-wide key naming an application from another org", async () => {
      prisma.application.findUnique.mockResolvedValue({ id: "app-2", organizationId: "org-2" });

      await expect(
        service.checkEntitlement(makeCtx({ applicationId: null }), "pro", "app-2"),
      ).rejects.toThrow(NotFoundException);
    });

    it("resolves an org-wide key naming an application in its own org", async () => {
      prisma.application.findUnique.mockResolvedValue({ id: "app-2", organizationId: "org-1" });
      runtimeAuth.hasEntitlement.mockResolvedValue({
        allowed: true,
        numberValue: null,
        textValue: null,
        isUnlimited: false,
      });

      await service.checkEntitlement(makeCtx({ applicationId: null }), "pro", "app-2");

      expect(runtimeAuth.hasEntitlement).toHaveBeenCalledWith("org-1", "app-2", "pro");
    });
  });

  describe("validateLicenseKey", () => {
    it("passes through a valid, in-tenant license as a shaped response", async () => {
      runtimeAuth.validateLicenseKey.mockResolvedValue({
        valid: true,
        licenseId: "lic-1",
        license: {
          organizationId: "org-1",
          applicationId: "app-1",
          type: "PERPETUAL",
          status: "ACTIVE",
          seatLimit: 5,
          deviceLimit: 3,
          expiresAt: null,
        },
      });

      const result = await service.validateLicenseKey(makeCtx(), "raw-key");

      expect(result).toEqual({
        valid: true,
        licenseId: "lic-1",
        type: "PERPETUAL",
        status: "ACTIVE",
        seatLimit: 5,
        deviceLimit: 3,
        expiresAt: null,
      });
    });

    it("hides a license that belongs to a different organization", async () => {
      runtimeAuth.validateLicenseKey.mockResolvedValue({
        valid: true,
        licenseId: "lic-1",
        license: {
          organizationId: "some-other-org",
          applicationId: "app-1",
          type: "PERPETUAL",
          status: "ACTIVE",
          seatLimit: null,
          deviceLimit: null,
          expiresAt: null,
        },
      });

      const result = await service.validateLicenseKey(makeCtx(), "raw-key");

      expect(result).toEqual({ valid: false, reason: "not_found" });
    });

    it("hides a license that belongs to a different application under an app-scoped key", async () => {
      runtimeAuth.validateLicenseKey.mockResolvedValue({
        valid: true,
        licenseId: "lic-1",
        license: {
          organizationId: "org-1",
          applicationId: "some-other-app",
          type: "PERPETUAL",
          status: "ACTIVE",
          seatLimit: null,
          deviceLimit: null,
          expiresAt: null,
        },
      });

      const result = await service.validateLicenseKey(
        makeCtx({ applicationId: "app-1" }),
        "raw-key",
      );

      expect(result).toEqual({ valid: false, reason: "not_found" });
    });

    it("passes through an invalid result unchanged", async () => {
      runtimeAuth.validateLicenseKey.mockResolvedValue({ valid: false, reason: "expired" });

      const result = await service.validateLicenseKey(makeCtx(), "raw-key");

      expect(result).toEqual({ valid: false, reason: "expired" });
    });
  });

  describe("validateSeat", () => {
    it("404s when the license doesn't belong to the key's organization", async () => {
      prisma.license.findUnique.mockResolvedValue({
        organizationId: "some-other-org",
        applicationId: "app-1",
      });

      await expect(service.validateSeat(makeCtx(), "lic-1", "user-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(runtimeAuth.validateSeat).not.toHaveBeenCalled();
    });

    it("delegates to RuntimeAuthorizationService once tenancy checks out", async () => {
      prisma.license.findUnique.mockResolvedValue({
        organizationId: "org-1",
        applicationId: "app-1",
      });
      runtimeAuth.validateSeat.mockResolvedValue(true);

      const result = await service.validateSeat(makeCtx(), "lic-1", "user-1");

      expect(result).toEqual({ valid: true });
      expect(runtimeAuth.validateSeat).toHaveBeenCalledWith("lic-1", "user-1");
    });
  });
});
