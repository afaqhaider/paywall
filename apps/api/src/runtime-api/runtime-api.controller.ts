import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { RequireApiKeyScope } from "../common/decorators/require-api-key-scope.decorator";
import { ApiKeyGuard, type ApiKeyAuthenticatedRequest } from "../common/guards/api-key.guard";
import { ApiKeyScopeGuard } from "../common/guards/api-key-scope.guard";
import { AdjustUsageDto } from "./dto/adjust-usage.dto";
import { ValidateLicenseKeyDto } from "./dto/validate-license-key.dto";
import { ValidateSeatDto } from "./dto/validate-seat.dto";
import { RuntimeApiService } from "./runtime-api.service";
import { RUNTIME_API_SCOPES } from "./scopes";

/**
 * The public runtime API: what an SS Zentronics-integrated app actually
 * calls at runtime, authenticated with an `X-API-Key` header rather than a
 * user session. This is the wire contract the official SDKs are built on
 * top of - see docs/RUNTIME_API.md. `@Public()` opts every route here out
 * of the global `JwtAuthGuard`; `ApiKeyGuard` + `ApiKeyScopeGuard` are the
 * real auth for this controller.
 */
@Public()
@UseGuards(ApiKeyGuard, ApiKeyScopeGuard)
@Controller("v1")
export class RuntimeApiController {
  constructor(private readonly runtimeApi: RuntimeApiService) {}

  @RequireApiKeyScope(RUNTIME_API_SCOPES.ENTITLEMENTS_READ)
  @Get("entitlements/:key/check")
  async checkEntitlement(
    @Param("key") key: string,
    @Query("applicationId") applicationId: string | undefined,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.checkEntitlement(req.apiKeyContext, key, applicationId);
  }

  @RequireApiKeyScope(RUNTIME_API_SCOPES.ENTITLEMENTS_READ)
  @Get("entitlements/:key/usage")
  async getUsage(
    @Param("key") key: string,
    @Query("applicationId") applicationId: string | undefined,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.getUsage(req.apiKeyContext, key, applicationId);
  }

  @RequireApiKeyScope(RUNTIME_API_SCOPES.ENTITLEMENTS_WRITE)
  @Post("entitlements/:key/usage/increment")
  async incrementUsage(
    @Param("key") key: string,
    @Body() dto: AdjustUsageDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.incrementUsage(
      req.apiKeyContext,
      key,
      dto.amount ?? 1,
      dto.applicationId,
    );
  }

  @RequireApiKeyScope(RUNTIME_API_SCOPES.ENTITLEMENTS_WRITE)
  @Post("entitlements/:key/usage/decrement")
  async decrementUsage(
    @Param("key") key: string,
    @Body() dto: AdjustUsageDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.decrementUsage(
      req.apiKeyContext,
      key,
      dto.amount ?? 1,
      dto.applicationId,
    );
  }

  @RequireApiKeyScope(RUNTIME_API_SCOPES.LICENSES_READ)
  @Post("licenses/validate")
  async validateLicenseKey(
    @Body() dto: ValidateLicenseKeyDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.validateLicenseKey(req.apiKeyContext, dto.licenseKey);
  }

  @RequireApiKeyScope(RUNTIME_API_SCOPES.LICENSES_READ)
  @Post("licenses/:licenseId/seats/validate")
  async validateSeat(
    @Param("licenseId") licenseId: string,
    @Body() dto: ValidateSeatDto,
    @Req() req: ApiKeyAuthenticatedRequest,
  ) {
    return this.runtimeApi.validateSeat(req.apiKeyContext, licenseId, dto.userId);
  }
}
