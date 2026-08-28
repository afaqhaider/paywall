# Developer Portal (Dashboard) - Core Pages

This document covers the "Developer Portal" section of the SSCodeAxis web app
(`apps/web/src/app/dashboard/**`): the pages an organization member uses to manage their
applications, products/plans, coupons, trials, features, usage limits, devices, licenses,
customers, subscriptions, and entitlements. Marketplace-facing pages, billing/payment-provider
pages, analytics, and platform-admin pages are out of scope here.

For the sign-up/sign-in/verification pages, see `docs/pages/auth.md` - this document assumes
an authenticated session and does not re-document auth.

## Org-scoping pattern

Every page in this document is wrapped in `<ProtectedRoute>` (`apps/web/src/components/protected-route.tsx`),
which reads auth status from `useAuth()` and redirects to `/login` if the user is
unauthenticated (rendering a loading state until status resolves). There is no route-level
guard beyond "is logged in" - authorization for specific actions is enforced server-side by
the API; the client does not pre-check org/app roles before rendering forms or buttons.

On top of that, almost every page reads `useOrg()` (`apps/web/src/lib/org-context.tsx`), a
context that:

- Fetches the user's organizations (`GET /organizations`) once authenticated.
- Persists the "currently selected" organization ID in `localStorage` under the key
  `ssz.selectedOrgId`, defaulting to the first organization if nothing is stored or the
  stored ID is no longer valid.
- Exposes `selectedOrgId` / `selectedOrg` / `organizations` / `selectOrg()` / `refresh()`.

Pages that list or create org-scoped resources (applications, products, coupons, trials,
customers, subscriptions, licenses, features, usage limits, devices, entitlements) implicitly
operate against `selectedOrgId` - there is no organization ID in the URL. The org switcher
(`OrgSwitcher`, rendered inside `DashboardNav`'s children slot on list-style pages) lets the
user change `selectedOrgId`, which changes what every one of these pages fetches. If no
organization is selected (e.g., brand-new user), list pages render an empty/"loading" state
and creation forms block submission with "Select an organization first."

Application-scoped sub-pages (everything under `/dashboard/apps/[applicationId]/...`) take
the application ID from the URL (`useParams()`) instead, and share a secondary tab bar,
`AppNav` (`apps/web/src/components/app-nav.tsx`), with tabs: Overview, Settings, Members,
Versions, Domains, Secrets, Environments, Financial, Listing. (Financial is documented
elsewhere.) None of these pages perform a client-side application-role check either; the API
enforces membership/role requirements and the UI just surfaces whatever error message comes
back.

`DashboardNav` (`apps/web/src/components/dashboard-nav.tsx`) is the persistent top header with
links to every top-level dashboard section plus a logout button; it accepts optional
`children` used to slot in the `OrgSwitcher` on pages that need it.

---

## /dashboard

**Purpose:** Landing page after login - shows the user's organizations and lets them create a new one.

**Access requirements:** Authenticated session only.

**API calls:**

- `GET /organizations` (via `useOrg`'s `refresh()`, on mount / after creating an org)
- `POST /organizations` - triggered by the "Create organization" form

**Key UI/behavior:** Lists all organizations the user belongs to as cards (name, slug,
role badge). Shows which org is "currently switched to" (from `useOrg`). A side form creates
a new organization by name (min length 2) and refreshes the list on success.

**Edge cases / notes:** If the user has zero organizations, shows "You don't belong to any
organizations yet" instead of the card grid.

---

## /dashboard/apps

**Purpose:** Lists all applications registered under the selected organization.

**Access requirements:** Org membership (any role) - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on mount and whenever `selectedOrgId` changes.

**Key UI/behavior:** Grid of application cards (display name, slug, status badge
ACTIVE/other, category, visibility badge). "Create application" button links to
`/dashboard/apps/create`. Clicking a card navigates to `/dashboard/apps/{id}`.

**Edge cases / notes:** No pagination/cursor on this list (unlike products/coupons/etc. -
returns a flat `ApplicationListResult`, not a `CursorResult`). No org selected -> empty state.

---

## /dashboard/apps/create

**Purpose:** Register a new application in the selected organization.

**Access requirements:** Org membership; requires `selectedOrgId` (blocks submit otherwise).

**API calls:**

- `POST /organizations/{selectedOrgId}/applications` on submit.

**Key UI/behavior:** Form fields: name (required, 2-150 chars), display name (optional,
defaults to name), description (optional, up to 2000 chars), category (optional), visibility
select (`PRIVATE` - only application members, or `INTERNAL` - visible to all org members). On
success, redirects to the new application's overview page.

**Edge cases / notes:** None notable.

---

## /dashboard/apps/[applicationId]

**Purpose:** Application overview - details, lifecycle status, and archive/restore control.

**Access requirements:** Requires org context (`selectedOrgId`) plus application membership
per the API; no client-side role gate.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications/{applicationId}` on load.
- `POST /organizations/{selectedOrgId}/applications/{applicationId}/archive` or
  `.../restore`, toggled based on current status, triggered by the "Archive
  application"/"Restore application" button.

**Key UI/behavior:** Shows display name, slug, status/visibility badges, description,
category, bundle identifier (iOS), package name (Android), web identifier, and created date.
Single lifecycle action toggles archive <-> restore.

**Edge cases / notes:** No confirmation dialog before archiving.

---

## /dashboard/apps/[applicationId]/settings

**Purpose:** Edit core application details and manage arbitrary key/value custom settings
(e.g. maintenance mode, support email, theme/branding).

**Access requirements:** Same as application overview - org context + app membership
enforced server-side.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications/{applicationId}` and
  `GET /applications/{applicationId}/settings` (parallel, on load).
- `PATCH /organizations/{selectedOrgId}/applications/{applicationId}` - "Save changes" on the
  details form (name, displayName, description, category, visibility).
- `PUT /applications/{applicationId}/settings/{key}` - "Save setting" (add/update one setting).
- `DELETE /applications/{applicationId}/settings/{key}` - "Remove" on a setting row.

**Key UI/behavior:** Two cards: "Application details" (same fields as create) and "Custom
settings" (a key/value list with add/remove). Setting values are parsed as JSON when
possible (e.g. `true`, numbers) and fall back to being stored as a plain string if `JSON.parse`
fails.

**Edge cases / notes:** No confirmation dialog before removing a setting.

---

## /dashboard/apps/[applicationId]/domains

**Purpose:** Manage custom domains attached to an application (SSL/verification status).

**Access requirements:** App-scoped; no client-side role check.

**API calls:**

- `GET /applications/{applicationId}/domains` on load.
- `POST /applications/{applicationId}/domains` - "Add domain" (domain string + isPrimary flag).
- `POST /applications/{applicationId}/domains/{domainId}/verify` - "Verify" button (only shown
  when not yet verified).
- `DELETE /applications/{applicationId}/domains/{domainId}` - "Remove" button.

**Key UI/behavior:** Table with domain (badge for "primary"), SSL status badge, verification
status badge, and row actions. No confirmation dialog on remove.

**Edge cases / notes:** None notable.

---

## /dashboard/apps/[applicationId]/environments

**Purpose:** Configure per-environment (DEVELOPMENT/etc.) base/API URLs and JSON blobs for
variables and feature flags; also manages granular per-key environment variables and CORS
allowed-origins, all scoped to the application.

**Access requirements:** App-scoped; no client-side role check.

**API calls:**

- `GET /applications/{applicationId}/environments` on load.
- `PUT /applications/{applicationId}/environments/{type}` - "Save {env} environment" (baseUrl,
  apiUrl, variables JSON, featureFlags JSON).
- `GET /applications/{applicationId}/environments/{environmentId}/variables` - loads per-key
  variables once an environment is selected/saved.
- `PUT .../environments/{environmentId}/variables/{key}` - create or update a variable
  (value + isSecret flag).
- `DELETE .../environments/{environmentId}/variables/{key}` - delete a variable.
- `GET /applications/{applicationId}/allowed-origins` on load.
- `POST /applications/{applicationId}/allowed-origins` - add an origin, optionally scoped to
  the currently selected environment.
- `DELETE /applications/{applicationId}/allowed-origins/{originId}` - remove an origin.

**Key UI/behavior:** Environment type selector (DEVELOPMENT/STAGING/PRODUCTION/etc., from
`APPLICATION_ENVIRONMENT_TYPES`) drives which environment's fields are shown. The
"Environment variables" blob (free-form JSON in the top form) is distinct from the per-key
"Environment Variables" table below it, which supports masking secret values (rendered as
`type="password"` inputs) and per-row save/delete. Allowed origins can be global or scoped
to one environment.

**Edge cases / notes:** The per-key variables and allowed-origins sections are disabled/empty
until an environment has been saved at least once (no `selectedEnvironmentId` yet). No
confirmation dialogs on delete.

---

## /dashboard/apps/[applicationId]/secrets

**Purpose:** Store and rotate application secrets (API keys, webhook secrets, etc.).

**Access requirements:** App-scoped; no client-side role check.

**API calls:**

- `GET /applications/{applicationId}/secrets` on load.
- `POST /applications/{applicationId}/secrets` - create (type, key, value).
- `PATCH /applications/{applicationId}/secrets/{secretId}` - rotate (new value only).
- `DELETE /applications/{applicationId}/secrets/{secretId}` - delete.

**Key UI/behavior:** Table shows key, type (from `APPLICATION_SECRET_TYPES`), and a masked
value (`•••• {lastFour}`). Values are never shown again after creation - "Values are
encrypted at rest and never shown again after creation - only a masked hint is displayed."
Rotate switches the row into an inline edit mode with Save/Cancel.

**Edge cases / notes:** No confirmation dialog before delete, despite being irreversible.

---

## /dashboard/apps/[applicationId]/versions

**Purpose:** Publish and track per-platform release versions (Android/iOS/Web) on named
tracks (e.g. "stable").

**Access requirements:** App-scoped; no client-side role check.

**API calls:**

- `GET /applications/{applicationId}/versions` on load.
- `POST /applications/{applicationId}/versions` - "Publish version" (track, androidVersion,
  iosVersion, webVersion, buildNumber, releaseNotes - all platform versions optional).
- `DELETE /applications/{applicationId}/versions/{versionId}` - "Delete".

**Key UI/behavior:** Table of versions with a "latest" badge per track, showing per-platform
version strings, build number, and release date. No pagination.

**Edge cases / notes:** No confirmation dialog before deleting a published version.

---

## /dashboard/apps/[applicationId]/members

**Purpose:** Manage application-level team membership (roles) and email-based invitations to
join the application.

**Access requirements:** App-scoped; role management is itself sensitive but not client-gated

- the API is expected to enforce who can add/remove members.

**API calls:**

- `GET /applications/{applicationId}/members` on load.
- `POST /applications/{applicationId}/members` - "Add member" (email of an existing account +
  role from `APPLICATION_MEMBER_ROLES`, e.g. VIEWER).
- `PATCH /applications/{applicationId}/members/{membershipId}` - role change via inline select.
- `DELETE /applications/{applicationId}/members/{membershipId}` - "Remove".
- `GET /applications/{applicationId}/invitations` on load.
- `POST /applications/{applicationId}/invitations` - "Send invite" (email + role, doesn't
  require the invitee to already have an account).
- `POST /applications/{applicationId}/invitations/{invitationId}/resend` - "Resend" (only
  enabled while status is PENDING).
- `DELETE /applications/{applicationId}/invitations/{invitationId}` - "Revoke" (only enabled
  while PENDING).

**Key UI/behavior:** Two tables: existing Members (with inline role `<Select>` and Remove)
and Pending Invitations (email, role, status badge, expiry, resend/revoke). After creating an
invite, the accept URL is shown once via a `CopyableSecret` component with an explicit "share
this link (it will not be shown again)" warning.

**Edge cases / notes:** "Add member" requires the invitee to already have an account (the
form label says so); invitations exist as a parallel path for people without accounts yet.
No confirmation dialogs on remove/revoke.

---

## /dashboard/apps/[applicationId]/listing

**Purpose:** Manage how the application appears as a listing in the public marketplace -
status lifecycle, details, categories, tags, media, changelog, and invite-only access.

**Access requirements:** App-scoped, plus needs `selectedOrgId` (the listing path is
org-and-app-scoped: `/organizations/{selectedOrgId}/applications/{applicationId}/listing`).

**API calls (all relative to that base path unless noted):**

- `GET {base}` on load.
- `GET /store/categories` (org-independent, via `apiFetch`, not `authedFetch`) - populates the
  category checklist.
- `PUT {base}` - "Save details" (tagline, description, visibility).
- `POST {base}/publish` / `{base}/unpublish` / `{base}/archive` - lifecycle buttons, each
  disabled when already in that state.
- `PUT {base}/categories` - "Save categories" (array of categoryIds).
- `PUT {base}/tags` - "Save tags" (comma-separated tag IDs parsed client-side).
- `POST {base}/media` / `DELETE {base}/media/{mediaId}` - add/remove screenshots or other
  media assets (type from `MEDIA_ASSET_TYPES`, e.g. SCREENSHOT).
- `POST {base}/changelogs` - add a changelog entry (version + notes).
- `POST {base}/invites` / `DELETE {base}/invites/{inviteId}` - manage invite-only access list.

**Key UI/behavior:** Status badge (DRAFT/PUBLISHED/ARCHIVED, inferred) with
publish/unpublish/archive buttons gated by current status. Visibility select from
`LISTING_VISIBILITIES`. Category picker is a checkbox list sourced from a separate,
org-independent taxonomy endpoint. Tags have no self-service creation UI - the tag ID input
is a raw comma-separated field, with an explicit note that tag creation is a platform-admin
action and IDs must be obtained out of band. Media and changelog sections are simple
add/list/remove forms. Invites section only matters when visibility is `INVITE_ONLY`.

**Edge cases / notes:** No confirmation dialogs on any of the destructive actions (remove
media, revoke invite). The category source (`/store/categories`) is fetched without org
scoping and fails silently to an empty list (`.catch(() => setCategories([]))`).

---

## /dashboard/products

**Purpose:** Lists all products under the selected organization.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/products` on load, `?cursor=...` for "Load more".

**Key UI/behavior:** Cursor-paginated grid of product cards (name, status badge, slug,
visibility badge). "Create product" links to `/dashboard/products/create`.

**Edge cases / notes:** Uses `CursorResult<Product>` - genuine cursor pagination (append on
"Load more"), unlike the applications list.

---

## /dashboard/products/create

**Purpose:** Create a new product, which must belong to one of the org's applications.

**Access requirements:** Org membership; requires at least one application to already exist
(blocks submit / shows "No applications yet - create one first" otherwise).

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load, to populate the application
  picker (defaults to the first application).
- `POST /organizations/{selectedOrgId}/products` on submit (applicationId, name, description,
  visibility).

**Key UI/behavior:** Application select, name (2-150 chars), description (up to 2000 chars),
visibility select from `PRODUCT_VISIBILITIES`. Redirects to the new product's detail page.

**Edge cases / notes:** None notable.

---

## /dashboard/products/[productId]

**Purpose:** Edit a product's details, archive/restore it, and manage its billing plans
(list + create).

**Access requirements:** Org membership (`selectedOrgId` needed for the product endpoints;
plans endpoints are not org-scoped in the URL).

**API calls:**

- `GET /organizations/{selectedOrgId}/products/{productId}` on load.
- `GET /products/{productId}/plans` on load, `?cursor=...` for "Load more".
- `PATCH /organizations/{selectedOrgId}/products/{productId}` - "Save changes" (name,
  description, visibility).
- `POST /organizations/{selectedOrgId}/products/{productId}/archive` or `.../restore` -
  toggled by current status.
- `POST /products/{productId}/plans` - "Create plan" (name, code, billingType from
  `PLAN_BILLING_TYPES`, trialEligible inferred from whether trialDays was entered, trialDays).

**Key UI/behavior:** Details form + archive/restore button. Plans table (name, code, billing
type, status badge) with a "Manage ->" link per plan to the plan detail page, cursor
pagination, and an inline create-plan form below.

**Edge cases / notes:** `trialEligible` is derived client-side from whether the trial-days
field is non-empty, not from an explicit checkbox.

---

## /dashboard/products/[productId]/plans/[planId]

**Purpose:** Edit a plan's details (billing type, trial, seat limit), archive/restore it, and
manage its prices (list + create + archive).

**Access requirements:** Org membership implied; the plan/price endpoints used here
(`/plans/{planId}`, `/plans/{planId}/prices`, `/prices/{priceId}/archive`) are not
org-scoped in the URL.

**API calls:**

- `GET /plans/{planId}` on load.
- `GET /plans/{planId}/prices` on load, `?cursor=...` for "Load more".
- `PATCH /plans/{planId}` - "Save changes" (name, description, billingType, trialEligible,
  trialDays, seatLimit).
- `POST /plans/{planId}/archive` or `.../restore` - toggled by current status.
- `POST /plans/{planId}/prices` - "Create price" (currency, amountMinor, interval from
  `BILLING_INTERVALS`, intervalCount).
- `POST /prices/{priceId}/archive` - "Archive" on an active price row.

**Key UI/behavior:** Details form with explicit "Trial eligible" checkbox (unlike the
product-level plan-create form). Prices table shows formatted amount (via
`formatMinorUnits`) plus raw minor units, interval (with count multiplier if >1), country
code or "Global", and status; only ACTIVE prices show an Archive action (prices are
immutable/append-only otherwise - no edit, only archive + create new).

**Edge cases / notes:** Prices cannot be edited once created, only archived; a new price
must be created to change amount/interval.

---

## /dashboard/coupons

**Purpose:** Lists discount coupon definitions for the selected organization.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/coupons` on load, `?cursor=...` for "Load more".

**Key UI/behavior:** List (not grid) of coupons showing code, discount summary (% off or
minor-unit amount off), duration, and status badge. Links to `/dashboard/coupons/{id}`.
"Create coupon" links to the create page.

**Edge cases / notes:** None notable.

---

## /dashboard/coupons/create

**Purpose:** Define a new coupon (the underlying discount rule; redeemable promotion codes
are added separately on the detail page).

**Access requirements:** Org membership; requires `selectedOrgId`.

**API calls:**

- `POST /organizations/{selectedOrgId}/coupons` on submit.

**Key UI/behavior:** Fields: code (required, up to 64 chars), name (optional), discount type
(`PERCENTAGE` or `FIXED` from `COUPON_DISCOUNT_TYPES`) which conditionally shows either a
percent-off input or amount-off-minor + currency inputs, duration (`ONCE`/`REPEATING`/etc.
from `COUPON_DURATIONS`) which conditionally shows a "duration in cycles" input when
`REPEATING`, max redemptions (optional), expires-at date (optional). Redirects to the new
coupon's detail page.

**Edge cases / notes:** None notable.

---

## /dashboard/coupons/[couponId]

**Purpose:** View/edit a coupon's redemption limits and expiry, archive it, and manage its
redeemable promotion codes.

**Access requirements:** Org membership; requires `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/coupons/{couponId}` on load.
- `PATCH /organizations/{selectedOrgId}/coupons/{couponId}` - "Save changes" (maxRedemptions,
  expiresAt only - discount type/amount are not editable here).
- `POST /organizations/{selectedOrgId}/coupons/{couponId}/archive` - "Archive coupon" (only
  shown when not already archived).
- `GET /coupons/{couponId}/promotion-codes` on load.
- `POST /coupons/{couponId}/promotion-codes` - "Create promotion code" (code, optional
  maxRedemptions).
- `POST /coupons/{couponId}/promotion-codes/{promotionCodeId}/deactivate` - "Deactivate"
  (only shown while active).

**Key UI/behavior:** Read-only summary of discount/duration/redemption-count at the top;
editable fields limited to max redemptions and expiry. Promotion codes table (code, active
badge, redemptions/max, expiry, deactivate action) plus an inline create form.

**Edge cases / notes:** Coupon's discount type/amount/duration cannot be changed after
creation via this page - only redemption cap, expiry, and archival.

---

## /dashboard/trials

**Purpose:** Read-only list of trials started for the selected organization.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/trials` on load, `?cursor=...` for "Load more".

**Key UI/behavior:** Table of status (badge colored by ACTIVE=success,
CONVERTED=default, CANCELED/EXPIRED=destructive, else outline), started date, ends date,
converted date. No actions - purely a monitoring view.

**Edge cases / notes:** Page explicitly notes "Trials are created implicitly when a
subscription starts with trial enabled" - there is no manual trial-creation form anywhere in
this page.

---

## /dashboard/features

**Purpose:** Define and archive the named capabilities ("features") an application exposes,
which plans/entitlements reference by key.

**Access requirements:** Org membership for the application picker; the features endpoints
themselves are app-scoped, not org-scoped in the URL.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load, to populate the application filter.
- `GET /applications/{applicationId}/features` whenever the selected application changes.
- `POST /applications/{applicationId}/features` - "Create feature" (key, name, description,
  type from `FEATURE_TYPES` e.g. BOOLEAN, unit).
- `POST /features/{featureId}/archive` - "Archive" (only shown for non-archived features).

**Key UI/behavior:** Application filter select drives the features table (key, name, type,
unit, archive action/badge). Create form below the table.

**Edge cases / notes:** No "restore" action visible for archived features on this page - once
archived, the row just shows an "Archived" badge with no further action.

---

## /dashboard/usage

**Purpose:** Configure usage ceilings (limits) per entitlement-definition key for an
application, view running counters, and manually reset counters.

**Access requirements:** Org membership for the application picker; limit endpoints are
org+app scoped in the URL.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load (application filter).
- `GET /applications/{applicationId}/entitlement-definitions` whenever the application
  changes (populates the "entitlement key" select for the create form).
- `GET /organizations/{selectedOrgId}/applications/{applicationId}/usage-limits` whenever
  org/application changes.
- `PUT .../usage-limits/{key}` - save/update a limit (used both for editing existing rows
  inline and for the "Add / update a limit" form at the bottom - same endpoint).
- `POST .../usage-limits/{key}/reset` - "Reset" button per row, resets the counter to zero.

**Key UI/behavior:** Table shows key, current counter value (with a "tracked"/"no activity
yet" badge), an editable limit-value input (disabled when "Unlimited" is checked), unlimited
checkbox, reset-policy select (`USAGE_RESET_POLICIES`), and per-row Save/Reset buttons. A
separate form below adds a limit for a not-yet-configured key.

**Edge cases / notes:** "Save" and the bottom "Save limit" button hit the same PUT endpoint -
PUT is idempotent create-or-update. No confirmation dialog before resetting a counter
(irreversible loss of the current count).

---

## /dashboard/devices

**Purpose:** View and manage device registrations (used for device-limit enforcement) per
application.

**Access requirements:** Org membership for the application picker; device endpoints are
org+app scoped.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load (application filter).
- `GET /organizations/{selectedOrgId}/applications/{applicationId}/devices` whenever
  org/application changes.
- `POST .../devices` - "Register device" (deviceId required, platform from
  `DEVICE_PLATFORMS` e.g. IOS, optional userId, optional appVersion).
- `POST .../devices/{deviceRegistrationId}/revoke` - "Revoke" (only shown while not BLOCKED).

**Key UI/behavior:** Table: device ID, platform, app version, last-seen timestamp, status
badge (ACTIVE=success), revoke action. Manual registration form below (mainly useful for
testing/support, since real registrations normally come from client SDKs).

**Edge cases / notes:** None notable.

---

## /dashboard/licenses

**Purpose:** Lists all licenses issued under the selected organization.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/licenses` on load, `?cursor=...` for "Load more".

**Key UI/behavior:** Cursor-paginated grid of license cards: type (INDIVIDUAL/SEAT/etc.),
status badge (via `licenseStatusVariant`), truncated ID, seat/device limits summary or "No
limits set", expiry date if set. "Create license" links to the create page.

**Edge cases / notes:** None notable.

---

## /dashboard/licenses/create

**Purpose:** Issue a new license under an application, optionally linked to a subscription.

**Access requirements:** Org membership; requires at least one application.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load (application picker, defaults to
  first).
- `POST /organizations/{selectedOrgId}/licenses` on submit (applicationId, type from
  `LICENSE_TYPES`, optional subscriptionId, optional seatLimit/deviceLimit, optional
  expiresAt).

**Key UI/behavior:** Application select, license type select, free-text subscription ID
input (not a dropdown - user must know/paste the UUID), seat/device limit numeric inputs
(blank = unlimited), expiry date. Redirects to the new license's detail page.

**Edge cases / notes:** Subscription linkage is a raw text field, not looked up/validated
client-side.

---

## /dashboard/licenses/[licenseId]

**Purpose:** The most complex page in this set - edit license limits/expiry, revoke it,
manage per-user assignment (INDIVIDUAL licenses) or bulk seats (SEAT licenses), and generate/
activate/revoke/transfer license keys.

**Access requirements:** Org membership; all endpoints are org-scoped in the URL.

**API calls:**

- `GET /organizations/{selectedOrgId}/licenses/{licenseId}` on load.
- `PATCH .../licenses/{licenseId}` - "Save changes" (seatLimit, deviceLimit, expiresAt);
  disabled once the license is REVOKED.
- `POST .../licenses/{licenseId}/revoke` - "Revoke license" (shown while not already revoked).
- `GET .../licenses/{licenseId}/assignments` - loaded only when `license.type === "INDIVIDUAL"`.
- `POST .../licenses/{licenseId}/assignments` - "Assign license" (userId).
- `DELETE .../licenses/{licenseId}/assignments/{userId}` - "Unassign".
- `GET .../licenses/{licenseId}/keys` on load.
- `POST .../licenses/{licenseId}/keys` - "Generate key" (activationLimit, optional
  expiresAt); disabled unless license status is ACTIVE.
- `POST .../licenses/{licenseId}/keys/{licenseKeyId}/activate` - "Activate" (only for ACTIVE
  keys).
- `POST .../licenses/{licenseId}/keys/{licenseKeyId}/revoke` - "Revoke" (only for ACTIVE keys).
- `POST .../licenses/{licenseId}/keys/{licenseKeyId}/transfer` - "Transfer" (targetLicenseId,
  free-text input per row).
- `GET .../licenses/{licenseId}/seats/summary` and `.../seats/history` (parallel) - loaded
  only when `license.type === "SEAT"`.
- `POST .../licenses/{licenseId}/seats` - "Create" (bulk seat creation by count, 1-10000).
- `POST .../licenses/{licenseId}/seats/assign` - "Assign" next available seat to a userId.
- `POST .../licenses/{licenseId}/seats/assignments/{seatAssignmentId}/remove` - "Remove".
- `POST .../licenses/{licenseId}/seats/assignments/{seatAssignmentId}/transfer` - "Transfer"
  (userId, free-text input per row).

**Key UI/behavior:** Details form + revoke button. "Assignment" card only for INDIVIDUAL
licenses (table of userId/assigned/unassigned + unassign action). "License keys" card
(always shown): generated key value is displayed exactly once via `CopyableSecret` with an
explicit "will not be shown again" warning; table shows activation count/limit, status,
expiry, and inline activate/revoke/transfer actions (transfer target is a free-text license
ID input). "Seats" card only for SEAT licenses: a 5-tile summary (total/available/assigned/
pending/inactive), an assignment-history table with remove/transfer actions, and two side-by-
side forms for bulk seat creation and "assign next available seat."

**Edge cases / notes:** No confirmation dialogs anywhere on this page despite several
destructive/high-stakes actions (revoke license, revoke key, remove seat assignment). Key
generation is blocked unless the license is currently ACTIVE. Transfer inputs (both license
key transfer and seat transfer) are raw text fields for target license ID / user ID - no
lookup/autocomplete.

---

## /dashboard/customers

**Purpose:** Lists platform-level customer identities for the selected organization.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/customers` on load, `?cursor=...` for "Load more".

**Key UI/behavior:** List of customers (display name or email or ID, email, type badge).
Links to `/dashboard/customers/{id}`. "Create customer" links to the create page.

**Edge cases / notes:** None notable.

---

## /dashboard/customers/create

**Purpose:** Create a new customer identity, optionally associated with a specific
application.

**Access requirements:** Org membership; requires `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load (optional application picker).
- `POST /organizations/{selectedOrgId}/customers` on submit (applicationId optional, type
  from `CUSTOMER_TYPES` e.g. INDIVIDUAL, displayName optional, email optional).

**Key UI/behavior:** Type select, display name, email, and an "Application (optional)" select
defaulting to "None". Redirects to the new customer's detail page.

**Edge cases / notes:** Unlike products/licenses, the application association here is
optional - a customer can exist without being tied to one application.

---

## /dashboard/customers/[customerId]

**Purpose:** Edit a customer's profile and view their subscriptions.

**Access requirements:** Org membership; requires `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/customers/{customerId}` on load.
- `PATCH /organizations/{selectedOrgId}/customers/{customerId}` - "Save changes" (displayName,
  email, type).
- `GET /organizations/{selectedOrgId}/subscriptions?limit=100` on load, then filtered
  client-side to this customer's subscriptions (`s.customerId === customerId`).

**Key UI/behavior:** Details form. Subscriptions table (status badge, quantity, period end,
link to subscription detail).

**Edge cases / notes:** The subscriptions list is fetched unfiltered (up to 100) and
filtered client-side by customer ID - there is no server-side "subscriptions for this
customer" endpoint used here, so a customer with subscriptions beyond the first 100 org-wide
subscriptions could have some missing from this view.

---

## /dashboard/subscriptions

**Purpose:** Lists all subscriptions for the selected organization, resolving customer/
product/plan IDs to display names via secondary lookups.

**Access requirements:** Org membership - implicit via `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/subscriptions` on load, `?cursor=...` for "Load more".
- `GET /organizations/{selectedOrgId}/customers?limit=100` and
  `GET /organizations/{selectedOrgId}/products?limit=100` (parallel, "non-fatal" lookup pass
  to populate name maps).
- `GET /products/{productId}/plans?limit=100` per distinct product ID present in the loaded
  subscriptions, to populate a plan-name map.

**Key UI/behavior:** Table: customer name (falls back to raw ID), "Product / Plan" (falls
back to raw IDs), status badge, quantity, period end, "View ->" link to the detail page.

**Edge cases / notes:** Name-resolution lookups are best-effort and swallow errors silently
(comment: "Non-fatal - lists still render with raw IDs as a fallback"); with more than 100
customers/products in the org, some names may not resolve and the raw UUID will show instead.

---

## /dashboard/subscriptions/create

**Purpose:** Attach a customer to a product/plan/price, optionally starting a trial.

**Access requirements:** Org membership; requires `selectedOrgId`.

**API calls:**

- `GET /organizations/{selectedOrgId}/customers?limit=100` and
  `.../products?limit=100` (parallel, on load).
- `GET /products/{productId}/plans?limit=100` - reloaded whenever the selected product changes.
- `GET /plans/{planId}/prices?limit=100` - reloaded whenever the selected plan changes.
- `POST /organizations/{selectedOrgId}/subscriptions` on submit (customerId, productId,
  planId, priceId, provider from `SUBSCRIPTION_PROVIDERS` e.g. MANUAL, quantity, startTrial).

**Key UI/behavior:** Cascading selects: customer -> product -> plan (disabled until a product
is chosen) -> price (disabled until a plan is chosen). Provider select, quantity input,
"Start trial" checkbox that is disabled unless the selected plan's `trialEligible` is true.
Redirects to the new subscription's detail page on success.

**Edge cases / notes:** Submit is blocked client-side unless customer, product, plan, and
price are all selected.

---

## /dashboard/subscriptions/[subscriptionId]

**Purpose:** The subscription lifecycle control center - view details, run status-transition
actions, schedule plan/price/quantity changes, apply coupons, and inspect event history.

**Access requirements:** Org membership for the subscription/customer/product lookups;
several action endpoints (`/subscriptions/{id}/...`) are not org-scoped in the URL.

**API calls:**

- `GET /organizations/{selectedOrgId}/subscriptions/{subscriptionId}` on load, followed by
  parallel `GET /organizations/{selectedOrgId}/customers/{customerId}`,
  `.../products/{productId}`, `GET /plans/{planId}` to resolve display names.
- `GET /organizations/{selectedOrgId}/subscriptions?limit=100` (best-effort, wrapped in its
  own try/catch) - used only to find the matching subscription's first line-item price for
  display, since the single-record `GET` doesn't include line items.
- `GET /subscriptions/{subscriptionId}/events` on load, `?cursor=...` for "Load more".
- `GET /subscriptions/{subscriptionId}/changes` on load.
- `POST /subscriptions/{subscriptionId}/{action}` - generic lifecycle action runner used for
  activate, renew, resume, pause, mark-past-due, expire, reactivate, cancel (with
  `atPeriodEnd` + optional `reason`), suspend (optional `reason`), enter-grace-period
  (optional `graceDays`). Which actions are visible is driven by a client-side
  `ACTIONS_BY_STATUS` map keyed on the subscription's current status (explicitly commented as
  a best-effort mirror of the server's real transition table - the server re-validates every
  transition regardless).
- `POST /subscriptions/{subscriptionId}/changes` - "Submit change" (type from
  `SUBSCRIPTION_CHANGE_TYPES` e.g. UPGRADE, optional targetPlanId/targetPriceId/
  targetQuantity, immediate flag for apply-now-with-proration vs. at-next-renewal).
- `POST /subscriptions/{subscriptionId}/changes/{changeId}/cancel` - "Cancel change" (only
  for PENDING changes).
- `POST /subscriptions/{subscriptionId}/coupons` - "Apply coupon" (couponId or
  promotionCode).

**Key UI/behavior:** Overview card (provider, quantity, price, version, current period,
trial window, cancel-at-period-end flag, grace period end). "Lifecycle actions" card renders
buttons dynamically based on `ACTIONS_BY_STATUS[subscription.status]`, with cancel/suspend/
enter-grace-period broken out into their own mini-forms (reason text, at-period-end
checkbox, grace-days number) rather than plain buttons. "Scheduled changes" table + create
form with cascading target-plan -> target-price selects (scoped to the subscription's
current product). "Apply coupon" form. "Event history" table (type, from/to status,
timestamp) with cursor "Load more".

**Edge cases / notes:** The client's `ACTIONS_BY_STATUS` map is explicitly a UI convenience,
not a source of truth - the server re-validates transitions independently, so it's possible
(if the map drifts from server logic) for a shown action to still be rejected, or a valid
action to not be shown. The line-item price lookup is a workaround (re-fetching the list
endpoint) because the single-subscription GET doesn't return price/line-item data.

---

## /dashboard/entitlements

**Purpose:** Manage entitlement definitions and manual entitlement grants for an application,
plus a "runtime check tester" that exercises the same read/usage endpoints the SDK uses at
request time.

**Access requirements:** Org membership for the application picker; grant/check endpoints are
org+app scoped.

**API calls:**

- `GET /organizations/{selectedOrgId}/applications` on load (application filter).
- `GET /applications/{applicationId}/entitlement-definitions` whenever the application
  changes (populates both the grant-creation "Entitlement" select and defaults
  `entitlementDefinitionId`).
- `GET /organizations/{selectedOrgId}/entitlement-grants?applicationId={applicationId}`
  whenever org/application changes.
- `POST /applications/{applicationId}/entitlement-definitions` - "Create definition" (key,
  name) - a quick-create so there's something to grant against.
- `POST /organizations/{selectedOrgId}/entitlement-grants` - "Create grant" (applicationId,
  entitlementDefinitionId, source from `ENTITLEMENT_GRANT_SOURCES` e.g. MANUAL, plus one of
  boolValue/numberValue/textValue, isUnlimited flag, optional validUntil).
- `DELETE /entitlement-grants/{grantId}` - "Revoke" (only shown for ACTIVE grants).
- `GET /organizations/{selectedOrgId}/applications/{applicationId}/entitlements/{key}/check` -
  "Check" button in the tester.
- `GET .../entitlements/{key}/usage` - "Get usage" button in the tester.
- `POST .../entitlements/{key}/usage/increment` - "Increment" button in the tester (amount).

**Key UI/behavior:** Grants table (key, source, status badge, value - unlimited/number/text/
bool, valid-until, revoke action) plus a create-grant form that's hidden behind a message
("create one below first") when no entitlement definitions exist yet for the application, and
a separate quick-create-definition form always shown below it. A distinct "Runtime check
tester" card lets a developer type an arbitrary entitlement key and hit check/usage/increment
directly, rendering the raw `allowed`/`numberValue`/`textValue`/`isUnlimited` (from check) or
`used`/`limit`/`remaining`/`isUnlimited` (from usage) response inline for debugging.

**Edge cases / notes:** No confirmation dialog before revoking a grant. The tester's
"Increment" action is a real, side-effecting usage increment against the org's live
data - it is not a dry-run/simulation despite being framed as a "tester."
