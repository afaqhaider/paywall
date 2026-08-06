import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_KEY_SCOPE_KEY } from "../decorators/require-api-key-scope.decorator";
import type { ApiKeyAuthenticatedRequest } from "./api-key.guard";

/**
 * Enforces `@RequireApiKeyScope`. Must run after `ApiKeyGuard` in the guard
 * chain (Nest runs a controller's guards in declaration order) since it
 * reads `request.apiKeyContext`, which only `ApiKeyGuard` attaches.
 */
@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(API_KEY_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiKeyAuthenticatedRequest>();
    const scopes = request.apiKeyContext?.scopes ?? [];

    if (scopes.includes("*") || scopes.includes(requiredScope)) {
      return true;
    }

    throw new ForbiddenException(`API key is missing required scope "${requiredScope}"`);
  }
}
