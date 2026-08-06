import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ApiKeyRequestContext } from "../common/guards/api-key.guard";
import {
  RuntimeAuthorizationService,
  type EntitlementCheckResult,
  type UsageSnapshot,
} from "../entitlements/runtime-authorization.service";

export type LicenseValidationResult =
  | { valid: false; reason: "not_found" | "inactive" | "expired" | "activation_limit_reached" }
  | {
      valid: true;
      licenseId: string;
      type: string;
      status: string;
      seatLimit: number | null;
      deviceLimit: number | null;
      expiresAt: Date | null;
    };

/**
 * Thin, tenant-safety layer between the public `/v1/*` runtime API and
 * `RuntimeAuthorizationService`. An API key resolved by `ApiKeyGuard` always
 * carries a trustworthy `organizationId` (and, for app-scoped keys, an
 * `applicationId`) straight from the database - never from anything the
 * caller supplied - so every method here either uses that directly or, when
 * an org-wide key must name an application explicitly, verifies the named
 * application actually belongs to that organization before touching it.
 */
@Injectable()
export class RuntimeApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeAuth: RuntimeAuthorizationService,
  ) {}

  async checkEntitlement(
    ctx: ApiKeyRequestContext,
    key: string,
    applicationId?: string,
  ): Promise<EntitlementCheckResult> {
    const appId = await this.resolveApplicationId(ctx, applicationId);
    return this.runtimeAuth.hasEntitlement(ctx.organizationId, appId, key);
  }

  async getUsage(
    ctx: ApiKeyRequestContext,
    key: string,
    applicationId?: string,
  ): Promise<UsageSnapshot> {
    const appId = await this.resolveApplicationId(ctx, applicationId);
    return this.runtimeAuth.getUsage(ctx.organizationId, appId, key);
  }

  async incrementUsage(
    ctx: ApiKeyRequestContext,
    key: string,
    amount: number,
    applicationId?: string,
  ): Promise<UsageSnapshot> {
    const appId = await this.resolveApplicationId(ctx, applicationId);
    return this.runtimeAuth.incrementUsage(ctx.organizationId, appId, key, amount);
  }

  async decrementUsage(
    ctx: ApiKeyRequestContext,
    key: string,
    amount: number,
    applicationId?: string,
  ): Promise<UsageSnapshot> {
    const appId = await this.resolveApplicationId(ctx, applicationId);
    return this.runtimeAuth.decrementUsage(ctx.organizationId, appId, key, amount);
  }

  async validateLicenseKey(
    ctx: ApiKeyRequestContext,
    licenseKey: string,
  ): Promise<LicenseValidationResult> {
    const result = await this.runtimeAuth.validateLicenseKey(licenseKey);
    if (!result.valid) {
      return result;
    }

    // The raw key alone proves possession, not tenancy - a key issued to one
    // org/app must not be validatable through another org's API key.
    if (
      result.license.organizationId !== ctx.organizationId ||
      (ctx.applicationId !== null && result.license.applicationId !== ctx.applicationId)
    ) {
      return { valid: false, reason: "not_found" };
    }

    return {
      valid: true,
      licenseId: result.licenseId,
      type: result.license.type,
      status: result.license.status,
      seatLimit: result.license.seatLimit,
      deviceLimit: result.license.deviceLimit,
      expiresAt: result.license.expiresAt,
    };
  }

  async validateSeat(
    ctx: ApiKeyRequestContext,
    licenseId: string,
    userId: string,
  ): Promise<{ valid: boolean }> {
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      select: { organizationId: true, applicationId: true },
    });

    if (
      !license ||
      license.organizationId !== ctx.organizationId ||
      (ctx.applicationId !== null && license.applicationId !== ctx.applicationId)
    ) {
      throw new NotFoundException("License not found");
    }

    const valid = await this.runtimeAuth.validateSeat(licenseId, userId);
    return { valid };
  }

  /**
   * App-scoped keys (`ctx.applicationId` set) always resolve to that
   * application - a caller-supplied `applicationId` is ignored rather than
   * trusted, so a key can never be used to reach a different app by just
   * naming it. Org-wide keys (`ctx.applicationId` is null) must name one
   * explicitly, and it's verified to belong to the key's organization.
   */
  private async resolveApplicationId(
    ctx: ApiKeyRequestContext,
    provided?: string,
  ): Promise<string> {
    if (ctx.applicationId) {
      return ctx.applicationId;
    }

    if (!provided) {
      throw new BadRequestException(
        "This API key isn't scoped to a single application - pass applicationId",
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: provided },
      select: { id: true, organizationId: true },
    });

    if (!application || application.organizationId !== ctx.organizationId) {
      throw new NotFoundException("Application not found");
    }

    return application.id;
  }
}
