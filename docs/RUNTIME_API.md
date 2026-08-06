# Runtime API (`/v1/*`)

This is the public, `X-API-Key`-authenticated HTTP surface that an
application built on the SS Zentronics Platform calls at runtime to answer
"can this user do that?" - entitlement checks, usage metering, and license
validation. It is the wire contract every official SDK (`packages/sdk-*`,
once built) wraps.

Everything else in this API (`/organizations/...`, `/dashboard`-backing
routes, `/admin/...`) is for humans logged into the Developer Portal, the
Customer Portal, or the Admin console via a JWT session. `/v1/*` is for
machines: your app's backend calling this platform, not a browser session.

Implementation: `apps/api/src/runtime-api/` (`RuntimeApiController` +
`RuntimeApiService`), on top of the pre-existing engine in
`apps/api/src/entitlements/runtime-authorization.service.ts`.

## Authentication

Every `/v1/*` request must carry:

```
X-API-Key: <raw key>
```

Get one from the Developer Portal: create an API client
(`POST /organizations/:organizationId/api-clients`), then a key under it
(`POST /api-clients/:apiClientId/keys`). An API client is either scoped to
one application (`applicationId` set) or org-wide (`applicationId: null`,
able to act across every application in the org - see
[Application scoping](#application-scoping) below).

Invalid, revoked, or expired keys get `401 Unauthorized`.

## Scopes

Each key carries a list of scope strings (`apps/api/src/runtime-api/scopes.ts`).
A request whose route requires a scope the key doesn't have gets
`403 Forbidden`. A key with the wildcard scope `"*"` passes every check.

| Scope                | Grants                                             |
| -------------------- | -------------------------------------------------- |
| `entitlements:read`  | Check entitlements and read usage                  |
| `entitlements:write` | Increment/decrement usage counters                 |
| `licenses:read`      | Validate a license key; validate a seat assignment |

Grant a scope at key creation (`CreateApiKeyDto.scopes`) or after the fact
via `POST /api-clients/:apiClientId/keys/:apiKeyId/scopes` with
`{ "scope": "entitlements:read" }`.

## Application scoping

If the key belongs to a single application, every endpoint below operates
on that application automatically - a `applicationId` in the request is
**ignored**, not trusted, so a key can never be redirected at a different
app just by naming one.

If the key is org-wide (no application), `applicationId` is **required**
on every call (query param on `GET`, body field on `POST`), and is
verified server-side to belong to the key's own organization before
anything runs - naming another org's application returns `404`, never a
cross-tenant read.

## Endpoints

### `GET /v1/entitlements/:key/check`

Query: `applicationId` (only for org-wide keys). Scope: `entitlements:read`.

```json
{ "allowed": true, "numberValue": null, "textValue": null, "isUnlimited": true }
```

### `GET /v1/entitlements/:key/usage`

Query: `applicationId` (only for org-wide keys). Scope: `entitlements:read`.

```json
{ "used": 42, "limit": 100, "remaining": 58, "isUnlimited": false }
```

### `POST /v1/entitlements/:key/usage/increment`

Body: `{ "amount"?: number, "applicationId"?: string }` (`amount` defaults
to 1). Scope: `entitlements:write`. Returns the same shape as
`GET .../usage` after applying the increment. `403` if the limit would be
exceeded.

### `POST /v1/entitlements/:key/usage/decrement`

Same body/response shape as increment, in reverse (floors at 0). Scope:
`entitlements:write`.

### `POST /v1/licenses/validate`

Body: `{ "licenseKey": string }`. Scope: `licenses:read`.

```json
{
  "valid": true,
  "licenseId": "...",
  "type": "PERPETUAL",
  "status": "ACTIVE",
  "seatLimit": 5,
  "deviceLimit": 3,
  "expiresAt": null
}
```

or, if invalid: `{ "valid": false, "reason": "not_found" | "inactive" | "expired" | "activation_limit_reached" }`.
A license belonging to a different organization (or, for app-scoped keys,
a different application) also reports `not_found` - it is never
distinguishable from a key that truly doesn't exist.

### `POST /v1/licenses/:licenseId/seats/validate`

Body: `{ "userId": string }` - the end user's id within your own app; this
platform never sees or stores anything else about that user. Scope:
`licenses:read`.

```json
{ "valid": true }
```

`404` if `licenseId` doesn't resolve to a license the calling key can see.

## What's not built yet

- No SDK client package exists yet (`@ssz/sdk-web` etc., referenced by the
  Developer Portal's code-snippet generator, are aspirational names - see
  `apps/api/src/sdk-config/sdk-config.service.ts`). This document is the
  contract the first one will be built against.
- No webhook exists for entitlement/usage changes - this is a pull-only
  (request/response) API today.
