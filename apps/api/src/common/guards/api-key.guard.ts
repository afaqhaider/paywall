import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { RuntimeAuthorizationService } from "../../entitlements/runtime-authorization.service";

export interface ApiKeyRequestContext {
  apiKeyId: string;
  apiClientId: string;
  organizationId: string;
  applicationId: string | null;
  scopes: string[];
}

export type ApiKeyAuthenticatedRequest = Request & { apiKeyContext: ApiKeyRequestContext };

/**
 * Guard for external API consumers (not admin/dashboard users): reads
 * `X-API-Key`, validates it via RuntimeAuthorizationService.validateApiKey
 * (the same hash-lookup + revoked/expired checks used everywhere else), and
 * attaches the resolved client context to the request. Not wired onto any
 * route yet - other apps in the ecosystem will apply `@UseGuards(ApiKeyGuard)`
 * once they have endpoints that should authenticate via API key rather than
 * a user JWT.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly runtimeAuth: RuntimeAuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyAuthenticatedRequest>();
    const header = request.headers["x-api-key"];
    const rawKey = Array.isArray(header) ? header[0] : header;

    if (!rawKey) {
      throw new UnauthorizedException("Missing X-API-Key header");
    }

    const result = await this.runtimeAuth.validateApiKey(rawKey);
    if (!result.valid) {
      throw new UnauthorizedException("Invalid, revoked, or expired API key");
    }

    request.apiKeyContext = {
      apiKeyId: result.apiKeyId,
      apiClientId: result.apiClientId,
      organizationId: result.organizationId,
      applicationId: result.applicationId,
      scopes: result.scopes,
    };

    return true;
  }
}
