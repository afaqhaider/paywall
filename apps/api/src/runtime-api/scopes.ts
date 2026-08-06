/**
 * Scope strings recognized by the runtime (SDK-facing) API - see
 * docs/RUNTIME_API.md. Grant these to an APIKey via the existing
 * `POST /organizations/:organizationId/api-clients/:apiClientId/keys`
 * route (`ApiKeysController`) to authorize it for the corresponding
 * `/v1/*` routes. A key holding scope `"*"` is authorized for everything.
 */
export const RUNTIME_API_SCOPES = {
  ENTITLEMENTS_READ: "entitlements:read",
  ENTITLEMENTS_WRITE: "entitlements:write",
  LICENSES_READ: "licenses:read",
} as const;

export type RuntimeApiScope = (typeof RUNTIME_API_SCOPES)[keyof typeof RUNTIME_API_SCOPES];
