# Platform Admin — Core Pages

This section documents the internal-only "Platform Admin" (a.k.a. Operations Center) pages under `apps/web/src/app/admin/**`. These pages are for platform staff (Super Admins) to manage organizations, applications, customers, subscriptions, licenses, and global platform configuration. They are **not** accessible to, or intended for, organization members/staff (who use the separate `DashboardNav` surface) or customers (who use the separate `PortalNav` surface).

## Access gating (applies to every page below)

All routes under `/admin/**` are wrapped by `apps/web/src/app/admin/layout.tsx`, which nests two gates:

1. `ProtectedRoute` — the standard app-wide "must be logged in" check (redirects unauthenticated users to login).
2. `AdminGate` (defined inline in `layout.tsx`) — an internal-only UX check. On mount it calls `GET /admin/platform-admins/me`; a successful response marks the user as admin and renders `AdminNav` plus the page. If that endpoint 404s (not yet deployed in some environments), it falls back to a secondary probe, `GET /admin/organizations?limit=1` (200 => admin, 403 => not admin). If neither check succeeds, the user is redirected to `/dashboard`.

**This client-side gate is a UX convenience only, not the real security boundary.** Every `/admin/*` API route independently enforces platform-admin authorization server-side and returns 403 for non-admins regardless of what the frontend does. Because this gate is identical for all pages in this document, the per-page "Access requirements" sections below simply confirm "platform-admin only (via layout gate)" and call out only page-specific _additional_ restrictions, if any.

The nav shell (`apps/web/src/components/admin-nav.tsx`) lists many more admin sections (financial integrations, ERP status, queues, audit center, fraud center, etc.) that are out of scope for this document — it covers only the 11 "core" pages below (overview, organizations, applications, customers, subscriptions, licenses, settings, announcements).

---

## /admin

**Purpose:** Platform-wide operations overview/home page — aggregate stats and a system-monitoring snapshot.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/reports/organizations`, `GET /admin/reports/applications`, `GET /admin/reports/subscriptions`, `GET /admin/reports/customer-growth` — fetched in parallel on mount via `Promise.allSettled` to populate the four stat cards (Organizations, Applications, Subscriptions, Customers).
- `GET /admin/monitoring/overview` — fetched on mount for the System Monitoring section (API Requests, Webhook Deliveries, ERP Synchronizations, Payment Processing, Queue Length, Worker Status).

**Key UI/behavior:**

- Stat cards link out to `/admin/organizations`, `/admin/applications`, `/admin/subscriptions`, `/admin/customers`.
- Count extraction from report payloads is defensive/best-effort (`extractCount` probes `total`, `count`, `totalCount`, `total_count`, or array length of `items`; falls back to "—").
- Each of the four report calls and the monitoring call uses `Promise.allSettled`, so an individual failure only blanks that one card/section rather than failing the whole page.
- Monitoring values are rendered raw (JSON or string) inside a `<pre>` block if "available" (`isAvailable`), otherwise "Not available" is shown.
- Links to `/admin/queues` for the full monitoring dashboard (not covered in this document).

**Edge cases / notes:** Purely read-only page — no mutating actions.

---

## /admin/organizations

**Purpose:** Browse all organizations on the platform.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/organizations` (cursor-paginated, optional `search` and `cursor` query params) — loaded on mount and on search submit.
- Same endpoint again with `cursor=<nextCursor>` — triggered by "Load more".

**Key UI/behavior:**

- Table of Name (links to detail page), Slug, Status (badge), Member count, Application count.
- Search box filters by name/slug; "Load more" appends to the existing list (cursor pagination, not page-based).
- Read-only list — no mutating actions on this page itself.

**Edge cases / notes:** None notable.

---

## /admin/organizations/[organizationId]

**Purpose:** Detail/management view for a single organization — status actions, ownership transfer, financial/ERP snapshot, and member list.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/organizations/{organizationId}` — loads org detail (status, slug, financial mode, ERP status, usage, members).
- `POST /admin/organizations/{organizationId}/suspend` — "Suspend" button.
- `POST /admin/organizations/{organizationId}/reactivate` — "Reactivate" button.
- `POST /admin/organizations/{organizationId}/archive` — "Archive" button.
- `DELETE /admin/organizations/{organizationId}` — "Delete" button.
- `POST /admin/organizations/{organizationId}/transfer-ownership` — "Transfer" button in the Transfer Ownership form, body `{ newOwnerUserId }`.

**Key UI/behavior:**

- **Sensitive/high-impact actions**, all confirmed only by disabling the button while in-flight (no confirmation dialog) except Delete:
  - **Suspend** — POST, no confirmation prompt.
  - **Reactivate** — POST, no confirmation prompt.
  - **Archive** — POST, no confirmation prompt.
  - **Delete** — guarded by a `confirm()` dialog reading "Soft-delete this organization? This cannot be easily undone." On success, navigates back to `/admin/organizations`. Despite the "soft-delete" wording in the confirm prompt, the UI treats it as effectively irreversible ("cannot be easily undone").
  - **Transfer Ownership** — POST with an arbitrary `newOwnerUserId` typed into a free-text input; no confirmation dialog, and no validation that the ID is a real/member user before submitting (the API is the enforcement point).
- All actions run through a shared `runAction` helper that reloads org detail on success and surfaces API errors inline; only one action can be in-flight at a time (buttons disabled while `actionBusy`).
- Financial/ERP card shows financial mode, ERP status, API usage count, and storage usage as read-only text (no controls).
- Members table is read-only (user, role, joined date) — no per-member actions on this page.

**Edge cases / notes:** Suspend/Reactivate/Archive have no client-side confirmation at all, unlike Delete — worth flagging to anyone extending this page, since they are otherwise just as consequential for the org's customers.

---

## /admin/applications

**Purpose:** Browse all applications across every organization on the platform.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/applications` (cursor-paginated, optional `search`/`cursor`) — on mount and search submit.
- Same endpoint with `cursor` — "Load more".

**Key UI/behavior:**

- Table: Name + slug (links to app detail), Organization (links to org detail), Status badge.
- Search filters by name/slug. Cursor-based "Load more" pagination.
- Read-only list.

**Edge cases / notes:** None notable.

---

## /admin/applications/[applicationId]

**Purpose:** Detail/management view for a single application — status actions, moving it between organizations, and read-only listings of versions, environments, API keys, webhooks, and secrets.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/applications/{applicationId}` — loads application detail.
- `POST /admin/applications/{applicationId}/suspend` — "Suspend" button.
- `POST /admin/applications/{applicationId}/restore` — "Restore" button.
- `POST /admin/applications/{applicationId}/archive` — "Archive" button.
- `POST /admin/applications/{applicationId}/move` — "Move" button in the "Move to a different organization" form, body `{ targetOrganizationId }`.

**Key UI/behavior:**

- **Sensitive/high-impact actions**, none with a client-side confirmation dialog:
  - **Suspend / Restore / Archive** — plain POSTs, immediate on click.
  - **Move to a different organization** — reassigns the application's owning org via a free-typed target org ID; no confirmation dialog. This is a structurally significant change (moves billing/licensing context) with no client-side safety net beyond disabling the button while busy.
- Versions table: track, per-platform version strings (web/iOS/Android), "latest" badge — read-only.
- Environments table: type, base URL, API URL — read-only.
- API Keys table: name, masked prefix/last-four, last-used timestamp, revoked flag — read-only (no revoke action on this page).
- Webhooks table: URL, status badge, event types — read-only.
- Secrets table: key, type, last four characters, rotated timestamp — explicitly documented in the UI as "Metadata only - no plaintext ever shown" — read-only.

**Edge cases / notes:** None of the mutating actions (Suspend/Restore/Archive/Move) have a `confirm()` guard, unlike the organization Delete action — inconsistent with the pattern used one level up.

---

## /admin/customers

**Purpose:** Browse all customers (end users) across every organization.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/customers` (cursor-paginated, optional `search`/`cursor`) — on mount and search submit.
- Same endpoint with `cursor` — "Load more".

**Key UI/behavior:**

- Table: Name (links to customer detail), Email, Organization.
- Search filters by name/email. Cursor-based "Load more".
- Read-only list.

**Edge cases / notes:** None notable.

---

## /admin/customers/[customerId]

**Purpose:** Detail/support view for a single customer account — account status actions, a dedicated "Support Tools" panel (impersonation, login links, account recovery actions), financial sync status, and read-only listings of subscriptions, licenses, devices, invoices, and receipts/transactions.

**Access requirements:** Platform-admin only (via layout gate). No further restriction beyond that — the Support Tools panel is gated by the same admin check, not a separate/higher permission tier.

**API calls:**

- `GET /admin/customers/{customerId}` — loads customer detail.
- `POST /admin/customers/{customerId}/suspend` — "Suspend" button (Account Actions).
- `POST /admin/customers/{customerId}/reactivate` — "Reactivate" button (Account Actions).
- `POST /admin/support/users/{userId}/impersonate` — "Generate impersonation token" button, body `{ targetRole, reason? }`.
- `POST /admin/support/users/{userId}/login-link` — "Generate login link" button, body `{ reason? }`.
- `POST /admin/support/users/{userId}/unlock` — "Unlock account" button.
- `POST /admin/support/users/{userId}/reset-password` — "Reset password" button.
- `POST /admin/support/users/{userId}/reset-2fa` — "Reset 2FA" button.
- `POST /admin/support/users/{userId}/invalidate-sessions` — "Invalidate sessions" button.

Note: support-tool calls use `userId` (`customer.userId ?? customerId`), which may differ from the `customerId` route param.

**Key UI/behavior:**

- **Sensitive/high-impact actions — this is the most sensitive page in this document:**
  - **Suspend / Reactivate** — plain POSTs, no confirmation dialog, reloads customer detail after.
  - **Generate impersonation token** ("Impersonate") — creates a token that lets platform staff act as the customer, with a caller-supplied `targetRole` (free-text input, defaulting to `"CUSTOMER"`) and an optional free-text `reason`. The token value and expiry are displayed directly in the page (`lastImpersonation.impersonationToken`) — no confirmation dialog before generating it.
  - **Generate login link** — produces a URL (`lastLoginLink.url`) that logs in as the customer; also no confirmation dialog.
  - **Unlock account, Reset password, Reset 2FA, Invalidate sessions** — all one-click POSTs (no `confirm()` guard) that materially change the customer's account security/access state. Invalidating sessions or resetting 2FA/password could lock the customer out until they re-authenticate through a new channel.
  - The UI labels this whole block "Support Tools" (visually flagged with an amber border/heading) and states inline: "Actions below operate on user account `{userId}`. All support actions are audit-logged." — reinforcing that these are meant to be exceptional, logged actions, not routine ones. There is a free-text "Reason" field recorded in the audit log, but it is optional, not required.
- Financial Sync Status card: read-only status + last-synced timestamp.
- Subscriptions / Licenses / Devices / Invoices / Receipts-Transactions: five read-only tables via a shared `SectionTable` helper — no per-row actions on this page (subscription/license management happens on `/admin/subscriptions` and `/admin/licenses`).

**Edge cases / notes:** None of the impersonation/login-link/account-recovery actions have client-side confirmation dialogs, despite being arguably more sensitive than the organization "Delete" action (which does have one). The generated impersonation token and login link are rendered in plain text on the page (`break-all` styling), so anyone with view access to that browser session/screen can see them until the page is closed or the state is replaced.

---

## /admin/subscriptions

**Purpose:** Browse and manage subscriptions across every organization, with an inline "Manage subscription" panel for lifecycle actions.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/subscriptions` (cursor-paginated, optional `search`, `status`, `cursor`) — on mount and on filter submit.
- Same endpoint with `cursor` — "Load more".
- `POST /admin/subscriptions/{id}/grant-complimentary` — "Grant complimentary" button.
- `POST /admin/subscriptions/{id}/cancel` — "Cancel" button.
- `POST /admin/subscriptions/{id}/pause` — "Pause" button.
- `POST /admin/subscriptions/{id}/resume` — "Resume" button.
- `POST /admin/subscriptions/{id}/renew` — "Renew" button.
- `POST /admin/subscriptions/{id}/extend-trial` — "Extend trial" button, body `{ days: Number(trialDays) }`.
- `POST /admin/subscriptions/{id}/adjust-renewal-date` — "Adjust renewal date" button, body `{ renewalDate }`.
- `POST /admin/subscriptions/{id}/change-plan` — "Change plan" button, body `{ planId: newPlanId }`.

**Key UI/behavior:**

- List table: ID, Status badge, Organization, Customer, Period end, and a "Manage" button that opens an inline management card for that row (`selectedId` state, one at a time).
- Search/status filter form (status options from `ADMIN_SUBSCRIPTION_STATUS_FILTERS`).
- **Sensitive/high-impact actions**, all one-click POSTs with no confirmation dialogs:
  - **Grant complimentary** — grants free/complimentary access, directly affects billing/revenue.
  - **Cancel** — terminates the subscription.
  - **Pause / Resume** — toggles active billing state.
  - **Renew** — forces a renewal.
  - **Extend trial (N days)** — free-text numeric days input.
  - **Adjust renewal date** — free-text date input, directly overrides the billing cycle date.
  - **Change plan** — free-text plan ID input with no plan picker/validation in the UI; a typo would silently target a non-existent or wrong plan (API is the actual validation boundary).
- All actions reload the list after success via the shared `runAction` helper; only one action busy at a time.

**Edge cases / notes:** None of the eight lifecycle actions have a `confirm()` guard, despite several (Cancel, Grant complimentary, Change plan) having direct billing/revenue consequences for real customers.

---

## /admin/licenses

**Purpose:** Browse all licenses across every organization, generate new licenses, and manage individual license lifecycle/ownership.

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/licenses` — initial load (note: unlike other list pages here, the initial load does not send `search`; there's no search box on this page).
- `GET /admin/licenses?cursor=...` — "Load more".
- `POST /admin/licenses` — "Generate" button in the "Generate a license" form, body `{ organizationId, applicationId, type }`.
- `POST /admin/licenses/{id}/transfer` — "Transfer" button per row, body `{ newUserId }`.
- `POST /admin/licenses/{id}/deactivate` — "Deactivate" button per row.
- `POST /admin/licenses/{id}/reactivate` — "Reactivate" button per row.
- `POST /admin/licenses/{id}/revoke` — "Revoke" button per row.

**Key UI/behavior:**

- "Generate a license" form takes free-text Organization ID and Application ID plus a Type select (`LICENSE_TYPES`); on success shows the generated key once inline ("Generated key (shown once)") — the key is not shown again after this render, matching a secret/one-time-reveal pattern.
- List table: ID, Type, Status badge, Organization, Expires, and a row of per-license actions plus a "new user ID" free-text input used by Transfer.
- **Sensitive/high-impact actions**, all one-click POSTs with no confirmation dialogs:
  - **Transfer** — reassigns the license to an arbitrary `newUserId` typed in-row; no validation in the UI that the target user exists or belongs to the right org/application.
  - **Deactivate** — disables the license.
  - **Reactivate** — re-enables it.
  - **Revoke** — permanently invalidates the license (typically irreversible/harder to undo than deactivate, though the exact server-side semantics live in the API, not this page).
- All row actions reload the list after success.

**Edge cases / notes:** No confirmation dialogs anywhere on this page, including Revoke and Transfer — both of which directly affect a customer's ability to use a licensed application. There is also no search/filter UI here (unlike Organizations/Applications/Customers/Subscriptions), so the list is unfiltered aside from cursor pagination.

---

## /admin/settings

**Purpose:** Central platform configuration: raw JSON key/value settings, feature flags, transactional message templates, and platform-admin role management (grant/revoke).

**Access requirements:** Platform-admin only (via layout gate). No further restriction — notably, granting/revoking _other_ platform admins happens on this same page with the same gate; there is no separate "super-admin" tier enforced client-side.

**API calls:**

- `GET /admin/config/settings/{key}` for each key in `KNOWN_SETTING_KEYS` — loaded per `SettingEditor` instance; a 404 is treated as "no value yet" (defaults the textarea to `"null"`) rather than an error.
- `PUT /admin/config/settings/{key}` — "Save" button per setting, body `{ value }` where `value` is `JSON.parse`d from the free-text textarea (save is blocked client-side if the text isn't valid JSON).
- `GET /admin/config/feature-flags` — loads feature flags list.
- `PATCH /admin/config/feature-flags/{key}` — "Toggle" button per flag, body `{ enabled: !flag.enabled }`.
- `POST /admin/config/feature-flags` — "Add" button in the new-flag form, body `{ key, enabled: false }`.
- `GET /admin/config/message-templates/{type}/{key}` — "Load" button in the Message Templates editor.
- `PUT /admin/config/message-templates/{type}/{key}` — "Save template" button, body `{ subject?, body }`.
- `GET /admin/platform-admins` — loads current platform admins.
- `POST /admin/platform-admins` — "Grant" button, body `{ userId }` (free-text user ID, no lookup/autocomplete).
- `DELETE /admin/platform-admins/{id}` — "Revoke" button per admin row.

**Key UI/behavior:**

- **Settings section**: each known key (`KNOWN_SETTING_KEYS`) gets its own editor card with a raw JSON textarea — this is a low-level, unvalidated (beyond JSON-parseability) editor for arbitrary platform configuration values. No schema validation, no diffing/preview before save.
- **Feature Flags section**: table of key, enabled badge, rollout percentage (read-only display of rollout %, no control to change it here), and a Toggle button per flag (no confirmation). New flags can be created via key-only form (defaults to disabled).
- **Message Templates section**: type/key free-text fields with explicit Load/Save actions (not auto-loaded), subject + body textarea.
- **Platform Admins section**: table of current admins (name/email, granted-at timestamp) with a per-row **Revoke** button.
  - **Sensitive/high-impact action:** **Revoke** is guarded by `confirm("Revoke platform admin access for this user?")` — this is the only page-level action on `/admin/settings` with a confirmation dialog. Since this page is only reachable by an existing platform admin, a mistaken/malicious revoke or self-revoke changes who can administer the whole platform.
  - **Grant** — POST with a free-text user ID and no confirmation dialog; grants full platform-admin (i.e., access to every page in this document, including impersonation and account-recovery tools) to that user ID with no client-side validation that the ID is correct.

**Edge cases / notes:** Settings/feature-flag/message-template saves have no confirmation dialogs and, for the raw-JSON settings editor in particular, no schema validation beyond well-formed JSON — a bad value could silently break platform behavior depending on how the API consumes it. Toggling a feature flag is instantaneous and platform-wide with no staged rollout control exposed in this UI beyond the read-only rollout percentage.

---

## /admin/announcements

**Purpose:** Create, edit, and delete platform-wide announcements shown to users (org staff and/or customers, per the announcement's type/scheduling).

**Access requirements:** Platform-admin only (via layout gate). No further restriction.

**API calls:**

- `GET /admin/config/announcements` — loads existing announcements on mount.
- `POST /admin/config/announcements` — "Create" button (when not editing), body `{ type, title, body, scheduledAt, expiresAt }`.
- `PATCH /admin/config/announcements/{id}` — "Update" button (when editing an existing announcement), same body shape.
- `DELETE /admin/config/announcements/{id}` — "Delete" button per row.

**Key UI/behavior:**

- Single form doubles as create/edit (`editingId` state); "Edit" on a row populates the form via `startEdit`, "Cancel" resets it.
- Fields: Type (select, from `ANNOUNCEMENT_TYPES`), Scheduled at / Expires at (datetime-local inputs, optional — sent as `null` if blank), Title (required), Body (required, textarea).
- Table lists all announcements with Title, Type badge, Scheduled/Expires timestamps, and per-row Edit/Delete buttons.
- **Delete** is guarded by `confirm("Delete this announcement?")`. Create/Update have no confirmation dialog (lower stakes than most actions in this document, but still platform-wide-visible content once published/scheduled).

**Edge cases / notes:** No preview of how/where the announcement will render before publishing; scheduling relies entirely on the `scheduledAt`/`expiresAt` values being correctly interpreted by the API (no timezone indicator shown in the UI).
