# Developer Portal — Developer Tools

Pages under `apps/web/src/app/dashboard/{api-keys,api-docs,oauth,analytics,analytics-org,white-label,profile}`. All pages are wrapped in `ProtectedRoute` and require an authenticated dashboard session (bearer JWT via `authedFetch`). Every page except **Profile** is scoped to the currently-selected organization (`useOrg().selectedOrgId`, driven by the `OrgSwitcher` in the nav) — some are further scoped to a specific application within that org. **Profile** is scoped to the logged-in user only and has no org switcher.

---

## /dashboard/api-keys

**Purpose:** List and create API clients (credential containers) for the selected organization, either organization-wide or bound to a specific application.

**Access requirements:** Organization-scoped. Backend: `ApiClientsController` under `OrganizationRoleGuard` — list requires `VIEWER`, create requires `ADMINISTRATOR`.

**API calls:**

- `GET /organizations/:selectedOrgId/applications` — populate the "Application" dropdown (on load).
- `GET /organizations/:selectedOrgId/api-clients` — list clients (on load / org change).
- `POST /organizations/:selectedOrgId/api-clients` — create a client, body `{ name, description?, applicationId? }` (submit form).

**Key UI/behavior:** Table of clients showing Name, Scope ("Application" vs "Organization-wide" based on whether `applicationId` is set), Created date, and a "Manage →" link to the client detail page. Create form: Name (required), Application (optional select — leaving blank creates an org-wide client), Description (optional).

**Edge cases / notes:** No key material is issued or shown here — this page only manages the client container; actual API keys are generated on the detail page.

---

## /dashboard/api-keys/[apiClientId]

**Purpose:** Manage a single API client's metadata and its API keys (generate, rotate, revoke, manage scopes).

**Access requirements:** Organization-scoped (via the client's owning org). Backend: `ApiKeysController` under `OrgScopedGuard` — list/get requires `VIEWER`; create/update/remove/revoke/rotate/add-scope/remove-scope all require `ADMINISTRATOR`.

**API calls:**

- `GET /organizations/:selectedOrgId/api-clients/:apiClientId` — load client details.
- `PATCH /organizations/:selectedOrgId/api-clients/:apiClientId` — save name/description edits.
- `GET /api-clients/:apiClientId/keys` — load keys list.
- `POST /api-clients/:apiClientId/keys` — generate a new key, body `{ name, environment, rateLimitPerMin?, scopes? }` (environment is "live" or "test").
- `POST /api-clients/:apiClientId/keys/:apiKeyId/revoke` — revoke a key.
- `POST /api-clients/:apiClientId/keys/:apiKeyId/rotate` — rotate (reissue) a key's secret.
- `POST /api-clients/:apiClientId/keys/:apiKeyId/scopes` — add a scope, body `{ scope }`.
- `DELETE /api-clients/:apiClientId/keys/:apiKeyId/scopes/:scope` — remove a scope.

**Key UI/behavior:** Details card (name/description, editable). Keys list shows each key's name, masked identifier (`keyPrefix…lastFour`), ACTIVE/REVOKED badge, its scopes as removable badges, an inline "add scope" input, and Revoke/Rotate buttons (Revoke disabled once already revoked). Generate-key form: Name (required), Environment (live/test), optional rate limit per minute, optional comma-separated scopes list.

**Edge cases / notes:** The raw key value (`generatedKey.plainText`) is displayed **only once**, immediately after generation or rotation, in a dismissable alert with a copy affordance (`CopyableSecret`) and explicit text "copy it now, it will not be shown again." It is never retrievable again from the list view (only the prefix/last-four are persisted client-side).

---

## /dashboard/api-docs

**Purpose:** Entry point to API reference documentation and per-application/per-environment SDK setup snippets.

**Access requirements:** Organization-scoped (application/environment selection scoped further within the org). No explicit role check observed in this page beyond being authenticated and org-selected; underlying application/environment/sdk-config endpoints require at least `VIEWER` at the application level.

**API calls:**

- `GET /organizations/:selectedOrgId/applications` — populate application selector.
- `GET /applications/:applicationId/environments` — populate environment selector once an application is chosen.
- `GET /applications/:applicationId/sdk-config/:platform?environmentId=:environmentId` — fetch the code snippet + instructions whenever application, environment, or platform changes.

**Key UI/behavior:** "API reference" card links out (new tab) to `${NEXT_PUBLIC_API_URL}/api-docs` (the API's own Swagger UI). "Authentication" card is static text explaining the two auth mechanisms: dashboard requests use `Authorization: Bearer <access_token>`; server-to-server/SDK requests use the `X-API-Key` header, with a link to the API Keys page. "Code samples" card: Application / Environment / Platform selects (platforms come from `SDK_PLATFORMS`), rendering the fetched `config.snippet` in a code block plus `config.instructions`.

**Edge cases / notes:** The Swagger UI is intentionally opened in a new tab rather than embedded via iframe — the page explains this is because the API runs on a different origin, so it wouldn't share the dashboard's auth cookies, and Swagger has its own independent "Authorize" flow.

---

## /dashboard/oauth

**Purpose:** Manage OAuth client applications (for third-party/OAuth login flows) scoped to a specific application within the org: create clients, manage credentials (secrets), redirect URIs, and callback URLs.

**Access requirements:** Application-scoped, chosen via a dropdown of the org's applications. Backend spans `ApplicationRoleGuard` (oauth-applications: list/get → `VIEWER`, create → `DEVELOPER`) and `ApplicationScopedGuard` on the credentials/redirect-uri/callback-url sub-controllers (add credential/rotate/add URI → `DEVELOPER`; delete app / revoke credential → `ADMINISTRATOR`).

**API calls:**

- `GET /organizations/:selectedOrgId/applications` — populate application selector.
- `GET /applications/:applicationId/oauth-applications` — list OAuth apps for the selected application.
- `POST /applications/:applicationId/oauth-applications` — create, body `{ name }`.
- `DELETE /applications/:applicationId/oauth-applications/:oauthApplicationId` — delete an OAuth app.
- `POST /oauth-applications/:oauthApplicationId/credentials` — add a new credential (secret).
- `PATCH /oauth-applications/:oauthApplicationId/credentials/:credentialId/rotate` — rotate a credential's secret.
- `DELETE /oauth-applications/:oauthApplicationId/credentials/:credentialId` — revoke a credential.
- `POST /oauth-applications/:oauthApplicationId/redirect-uris` — add, body `{ uri }`.
- `DELETE /oauth-applications/:oauthApplicationId/redirect-uris/:redirectUriId` — remove.
- `POST /oauth-applications/:oauthApplicationId/callback-urls` — add, body `{ url }`.
- `DELETE /oauth-applications/:oauthApplicationId/callback-urls/:callbackUrlId` — remove.

**Key UI/behavior:** Per-OAuth-app card shows a Delete button, a Credentials list (masked `clientId •••• lastFour`, ACTIVE/REVOKED badge, Rotate/Revoke buttons disabled once revoked) with an "Add credential" button, a Redirect URIs list with add/remove, and a Callback URLs list with add/remove (placeholder examples: `https://app.example.com/oauth/callback` for redirect URIs vs `myapp://auth-callback` for callback URLs, suggesting web vs. native/deep-link use).

**Edge cases / notes:** Creating an OAuth app auto-generates its first credential; the plaintext secret (`created.credentials[0].plainText`) is shown **only once**, alongside the client ID, with the "copy it now" warning. Rotating or adding a credential likewise surfaces the new plaintext secret once, per-app, via the same one-time alert pattern. No client-side format validation is performed on redirect URI / callback URL input (server-side validation, if any, is not visible from this page).

---

## /dashboard/analytics

**Purpose:** Per-application developer metrics — API request volume, auth allow/deny checks, webhook delivery health, and coarse business counts — for one application within the org.

**Access requirements:** Application-scoped (selected via dropdown, driven by an `applicationId` state variable, not a route param). Backend: `AnalyticsController` under `ApplicationRoleGuard`, all four endpoints require `VIEWER`.

**API calls (all keyed off the currently selected `applicationId` and `range`):**

- `GET /organizations/:selectedOrgId/applications` — populate application selector.
- `GET /applications/:applicationId/analytics/api-requests?range=daily|monthly`
- `GET /applications/:applicationId/analytics/auth-requests?range=daily|monthly`
- `GET /applications/:applicationId/analytics/webhook-stats`
- `GET /applications/:applicationId/analytics/business-metrics`

**Key UI/behavior:** Range selector (Daily = last 30 days, Monthly = last 12 months) affects the two time-series calls only (webhook-stats and business-metrics are not range-scoped). Stat tiles: Subscriptions, Active subscriptions, Active customers, Active licenses. Webhook card: success rate badge (green if ≥95%) plus succeeded/failed/total counts. Two bar-chart cards: "API requests" (count per period) and "Auth requests (allowed vs. denied)" — bars show only the _allowed_ count per period, with a note that denied counts are tracked separately per period (not visualized as a stacked/second bar).

**Edge cases / notes:** This is the **per-application** analytics view — distinct from `/dashboard/analytics-org` (see below), which is organization-wide. If no application exists yet, all metrics are empty/hidden.

---

## /dashboard/analytics-org

**Purpose:** Organization-wide "Developer Analytics" bundle — a broader, newer aggregate view (revenue, customers, subscriptions, renewals, trials, refunds, API requests, licenses, devices/active-user counts, webhook deliveries, usage trend) that is _not_ scoped to a single application.

**Access requirements:** Organization-scoped only (no application selector). Backend: distinct, newer controller `DeveloperAnalyticsController` under `OrganizationRoleGuard`, single endpoint requires `VIEWER`.

**API calls:**

- `GET /organizations/:selectedOrgId/analytics?period=DAILY|WEEKLY|MONTHLY|...` (periods from `ANALYTICS_PERIODS`) — the sole data call, returns a `DeveloperAnalyticsBundle`.

**Key UI/behavior:** Period selector (values from `ANALYTICS_PERIODS`, default `MONTHLY`). Large stat-tile grid: Revenue (minor units), Customers, Active/total subscriptions, New subscriptions, Renewals, Trial conversion rate, Refund rate, API requests, Active/total licenses, License usage rate, Devices, Daily/Monthly active users, Webhook deliveries. "Webhook delivery status" card breaks deliveries down by status (`bundle.webhookDeliveries.byStatus`). "Usage trend" bar chart plots `apiRequests` per day from `bundle.usageTrends`.

**Edge cases / notes:** The page subtitle explicitly calls out that this is "distinct from the per-application view under Analytics" — i.e. this page and `/dashboard/analytics` are two separate features, not the same page under different names: this one aggregates across the whole org (all applications, plus org-level billing/subscription data) rather than one application, and pulls from a different backend controller (`platform-analytics/developer-analytics.controller.ts` vs `analytics/analytics.controller.ts`).

---

## /dashboard/white-label

**Purpose:** Configure custom branding (logo, brand name, colors, custom domain, email sender name) applied to the org's customer-facing surfaces (customer portal, marketplace listing, outbound emails).

**Access requirements:** Organization-scoped. Backend: `WhiteLabelController` under `OrganizationRoleGuard` — get requires `VIEWER`, update requires `ADMINISTRATOR`.

**API calls:**

- `GET /organizations/:selectedOrgId/white-label` — load current config (may return `null` if unconfigured).
- `PATCH /organizations/:selectedOrgId/white-label` — save, body `{ logoUrl?, brandName?, primaryColor?, secondaryColor?, customDomain?, emailFromName? }` (empty string fields sent as `undefined`).

**Key UI/behavior:** Single form: Brand name, Logo URL (`type=url`), Primary/Secondary color (free-text, e.g. hex), Custom domain, Email sender name. No live/visual preview is rendered on this page — it's a plain settings form.

**Edge cases / notes:** If no config exists yet (`GET` returns `null`), the page shows a note that platform defaults are used until settings are saved here — there is no "reset to default" action, only save.

---

## /dashboard/profile

**Purpose:** View/edit the logged-in user's own personal information and change their account password. The only page in this set not scoped to an organization.

**Access requirements:** Authenticated user only — no organization or role requirement. Backend `ProfileController` has no guard/role decorators beyond the global auth guard; `/auth/change-password` likewise requires only authentication.

**API calls:**

- `GET /profile` — load profile on mount.
- `PATCH /profile` — save personal info, body `{ firstName, lastName, displayName, timezone, language, country, phone }`.
- `POST /auth/change-password` — body `{ currentPassword, newPassword }`.

**Key UI/behavior:** "Personal information" card: First/Last name, Display name, Email (read-only, disabled input), Timezone, Country (uppercased, max 2 chars — ISO country code), Phone. "Change password" card: Current password, New password (`minLength=12`), separate submit/loading/message state from the profile form.

**Edge cases / notes:** Email is displayed but not editable from this form (no email-change flow present here). Two independent forms/error states on one page — a profile-save failure doesn't affect the password form and vice versa.
