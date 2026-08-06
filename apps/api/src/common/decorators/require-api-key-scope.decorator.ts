import { SetMetadata } from "@nestjs/common";

export const API_KEY_SCOPE_KEY = "requiredApiKeyScope";

/**
 * Marks a route (already behind `ApiKeyGuard`) as requiring the given scope
 * on the presented API key. Enforced by `ApiKeyScopeGuard`. A key holding
 * the wildcard scope `"*"` satisfies any requirement.
 */
export const RequireApiKeyScope = (scope: string) => SetMetadata(API_KEY_SCOPE_KEY, scope);
