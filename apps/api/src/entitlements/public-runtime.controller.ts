import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard, type ApiKeyAuthenticatedRequest } from "../common/guards/api-key.guard";
import { Public } from "../common/decorators/public.decorator";
import { RuntimeAuthorizationService } from "./runtime-authorization.service";
import { IncrementUsageDto } from "./dto/increment-usage.dto";
import { ValidateLicenseKeyDto } from "./dto/validate-license-key.dto";

/**
 * The actual "runtime SDK surface" over HTTP, authenticated by the calling
 * application's own API key (`X-API-Key`) rather than a dashboard user
 * session - this is what an integrating app's OWN backend calls at runtime
 * to answer "can this customer do X" and "is this license key real",
 * exactly the questions `RuntimeAuthorizationService` was built to answer
 * (see its own class doc) but which previously had no API-key-gated route -
 * only `EntitlementRuntimeController` in entitlements.controller.ts, which
 * is dashboard-JWT + org-role gated for a human inspecting their own org's
 * entitlements, not for machine-to-machine runtime checks.
 *
 * `applicationId` always comes from the resolved API key's own scope
 * (`apiKeyContext`), never from the request body/params - a key can only
 * ever check/mutate entitlements for the one application it was issued
 * for, so there's no additional authorization decision to make here beyond
 * "is this a valid key".
 */
@Public()
@UseGuards(ApiKeyGuard)
@Controller("public/runtime")
export class PublicRuntimeController {
  constructor(private readonly runtimeAuth: RuntimeAuthorizationService) {}

  @Get("entitlements/:key")
  async checkEntitlement(@Param("key") key: string, @Req() req: ApiKeyAuthenticatedRequest) {
    const { organizationId, applicationId } = this.requireAppScope(req);
    return this.runtimeAuth.hasEntitlement(organizationId, applicationId, key);
  }

  @Get("entitlements/:key/usage")
  async getUsage(@Param("key") key: string, @Req() req: ApiKeyAuthenticatedRequest) {
    const { organizationId, applicationId } = this.requireAppScope(req);
    return this.runtimeAuth.getUsage(organizationId, applicationId, key);
  }

  @Post("entitlements/:key/increment")
  async incrementUsage(
    @Param("key") key: string,
    @Body() dto: IncrementUsageDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    const { organizationId, applicationId } = this.requireAppScope(req);
    return this.runtimeAuth.incrementUsage(organizationId, applicationId, key, dto.amount ?? 1);
  }

  @Post("entitlements/:key/decrement")
  async decrementUsage(
    @Param("key") key: string,
    @Body() dto: IncrementUsageDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    const { organizationId, applicationId } = this.requireAppScope(req);
    await this.runtimeAuth.decrementUsage(organizationId, applicationId, key, dto.amount ?? 1);
    return { success: true };
  }

  /**
   * Deliberately returns only what a caller needs to make a decision
   * (valid/invalid + why + the license id to look up elsewhere) - never the
   * raw `License` row, which carries fields (`createdById`, `metadata`,
   * `subscriptionId`, ...) that aren't this endpoint's business to expose.
   */
  @Post("license-keys/validate")
  async validateLicenseKey(@Body() dto: ValidateLicenseKeyDto) {
    const result = await this.runtimeAuth.validateLicenseKey(dto.key);
    if (!result.valid) {
      return { valid: false, reason: result.reason };
    }
    return {
      valid: true,
      licenseId: result.licenseId,
      status: result.license.status,
      type: result.license.type,
      expiresAt: result.license.expiresAt,
      seatLimit: result.license.seatLimit,
      deviceLimit: result.license.deviceLimit,
    };
  }

  private requireAppScope(req: ApiKeyAuthenticatedRequest) {
    const { organizationId, applicationId } = req.apiKeyContext;
    if (!applicationId) {
      throw new BadRequestException(
        "This API key is not scoped to a single application - entitlement/usage checks require an application-scoped key",
      );
    }
    return { organizationId, applicationId };
  }
}
