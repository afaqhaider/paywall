# Customer Portal

The Customer Portal (`apps/web/src/app/portal/**`) is the self-service area for **end customers** — people or accounts who have purchased a subscription/license to an application built on the SSCodeAxis. It is not used by the developers/vendors who built that application (see the Developer Portal) or by platform administrators (see the Admin Console).

A single logged-in user can be a customer of more than one vendor organization/application at once (e.g. they bought subscriptions to two unrelated SaaS products both running on this platform). The portal models this as a list of **customer relationships**, fetched once from `GET /customer-portal/me/customers` and held in `CustomerProvider` (`apps/web/src/lib/customer-context.tsx`). The user's current selection (`selectedCustomerId`) is persisted in `localStorage` (`ssz.selectedCustomerId`) and exposed via `useCustomer()`. Every page below renders a `CustomerSwitcher` in the `PortalNav` so the user can flip between relationships, and almost every data call is scoped to `selectedCustomerId` as `/customer-portal/customers/{selectedCustomerId}/...`. Two pages instead call account-wide `/customer-portal/me/...` endpoints (Notifications, Security, Settings) since notifications, login/2FA, and profile are properties of the person, not of a given vendor relationship — this is called out per page below.

All pages are wrapped in `ProtectedRoute`, i.e. require an authenticated session; unauthenticated visitors are redirected. Nothing here requires developer/vendor or platform-admin roles.

---

## /portal

**Purpose:** Portal home/dashboard — a quick-glance summary of the currently-selected customer relationship (active subscriptions, next renewal, licenses, devices, unread notifications).

**Access requirements:** Authenticated customer session. Scoped to the currently-selected customer relationship; if none is selected (no customer accounts yet) it shows an empty state instead of calling the summary endpoint.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/dashboard` — fetches `CustomerDashboardSummary` (active subscription count, next renewal date, license count, device count, unread notification count). Triggered on mount and whenever `selectedCustomerId` changes.

**Key UI/behavior:** Stat cards link out to `/portal/subscriptions`, `/portal/licenses`, `/portal/devices`, `/portal/notifications`. Shows which application/organization is currently being viewed (`selectedCustomer.applicationName` / `organizationName`).

**Edge cases / notes:** Read-only page, no mutating actions. If the user has zero customer relationships, shows "You don't have any customer accounts yet" rather than an error.

---

## /portal/organizations

**Purpose:** Lists every organization/application the logged-in user has a customer relationship with, and lets them switch which one is "active" for the rest of the portal. This is distinct from the Developer Portal's org switcher — there it's about which vendor org a developer manages; here it's "which vendor am I a customer of, and which one am I currently viewing."

**Access requirements:** Authenticated customer session. Not scoped to a single relationship — this page is what lists/manages all of them.

**API calls:** None directly — reuses the relationship list already loaded by `CustomerProvider` via `GET /customer-portal/me/customers`. No additional fetch on this page.

**Key UI/behavior:** Renders one card per `CustomerRelationship` showing organization name, application name, customer type badge, and optional account display name. Clicking "Switch to this account" / the currently-selected card calls `selectCustomer(customerId)`, which just updates local state + `localStorage` (no API call).

**Edge cases / notes:** Purely a client-side selection — switching relationships doesn't hit the API, it just changes which `selectedCustomerId` subsequent pages scope their requests to.

---

## /portal/subscriptions

**Purpose:** Lists all subscriptions the selected customer relationship holds.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/subscriptions` — loads the list on mount / on customer switch.

**Key UI/behavior:** Read-only list/grid; each card shows product name, plan name, status badge, renew/end date (`cancelAtPeriodEnd` flips the label between "Renews"/"Ends"), and quantity. Clicking a card navigates to the subscription detail page.

**Edge cases / notes:** No actions here — cancel/renew/change-plan all live on the detail page.

---

## /portal/subscriptions/[subscriptionId]

**Purpose:** Detail view and self-service management for a single subscription — billing period, line items, and actions to renew, pause, resume, cancel, or change plan.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`. The `subscriptionId` comes from the URL; the API implicitly verifies it belongs to the selected customer relationship.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}` — subscription detail, loaded on mount.
- `GET /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/changes` — plan-change history, loaded alongside (failure is swallowed to `[]` rather than surfaced as an error).
- `POST /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/renew` — "Renew" button.
- `POST /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/pause` — "Pause" button.
- `POST /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/resume` — "Resume" button.
- `POST /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/cancel` — "Cancel subscription" form, body `{ immediate: boolean, reason?: string }`.
- `POST /customer-portal/customers/{selectedCustomerId}/subscriptions/{subscriptionId}/change` — "Submit plan change" form, body `{ type, targetPlanId?, targetPriceId?, targetQuantity?, immediate }` where `type` is one of `UPGRADE`, `DOWNGRADE`, `INTERVAL_CHANGE`, `SEAT_CHANGE`.

**Key UI/behavior:** All of renew/pause/resume/cancel/change-plan are **self-service** — the customer can trigger them directly with no approval step. Cancel supports an optional reason and an "immediate vs. at period end" toggle. Plan change requires manually entering target plan ID / price ID / quantity (raw IDs, not a picker) and an immediate-vs-period-end toggle. Every action re-fetches subscription + change history afterward and shows a success/error banner. Change history table shows type, status, effective date, and applied date.

**Edge cases / notes:** The plan-change form takes raw plan/price IDs as free-text input rather than a dropdown of available plans — the customer (or whoever is helping them) needs to already know the target IDs. Change-history fetch failing silently degrades to an empty list instead of blocking the page.

---

## /portal/invoices

**Purpose:** Lists invoices for the selected customer relationship, with search/filter and PDF download.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/invoices?cursor=&search=&status=` — cursor-paginated list; `search`/`status` query params applied from the filter form.
- `GET /customer-portal/customers/{selectedCustomerId}/invoices/{invoiceId}/download` — triggered by "Download PDF" per row; returns `{ url }` (opened in a new tab) or `{ message }` if no URL is available.

**Key UI/behavior:** Free-text "Search" (matched against invoice number) and "Status" filter (free-text, e.g. `PAID`, `OPEN`) submitted via a form. Table shows invoice number, status badge, amount due (formatted via `formatMinorUnits`), issued date. "Load more" appends the next cursor page. "Download PDF" is self-service, per-row, with a per-row loading state.

**Edge cases / notes:** PDF generation/availability is **on-demand, not guaranteed** — the download endpoint can come back without a `url`, in which case the page shows a notice like "The PDF for this invoice isn't available yet" instead of opening anything. Status filter is a plain text input, not a constrained dropdown, so it relies on the customer typing a valid status value.

---

## /portal/receipts

**Purpose:** Lists payment receipts for the selected customer relationship.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/receipts` — cursor-paginated list, loaded on mount.
- Same endpoint with `?cursor=...` for "Load more".

**Key UI/behavior:** Read-only table: receipt number, amount (formatted), issued/created date. No filters, no per-row download action (unlike invoices).

**Edge cases / notes:** Notably has no "download PDF" action, unlike invoices — receipts are presented as a plain list only.

---

## /portal/transactions

**Purpose:** Lists raw payment transactions (including refund/dispute flags and ERP sync status) for the selected customer relationship.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/transactions?cursor=&status=` — cursor-paginated, filterable by free-text status (e.g. `SUCCEEDED`, `FAILED`).
- Same endpoint with `?cursor=...` for "Load more".

**Key UI/behavior:** Read-only table: transaction ID, status badge (plus "refunded"/"disputed" badges when `refunds`/`disputes` arrays are non-empty), amount, ERP sync status badge, ERP reference number, created date.

**Edge cases / notes:** Surfaces backend/ERP integration details (`syncStatus`, `erpReferenceNumber`) directly to the end customer — this is the most "raw" of the money-related list pages, no actions available.

---

## /portal/licenses

**Purpose:** Lists licenses held by the selected customer relationship (type, status, seat/device limits, validity dates).

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/licenses` — loaded on mount / customer switch.

**Key UI/behavior:** Read-only table: license type, status badge, seat limit, device limit, issued date, expiry date (or "Never").

**Edge cases / notes:** No self-service actions (no renew/revoke here) — purely informational; license lifecycle actions live elsewhere (subscription page) or are vendor/admin-only.

---

## /portal/devices

**Purpose:** Lists devices registered against the selected customer relationship's licenses, and lets the customer rename, deactivate, or remove them.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/devices` — loaded on mount.
- `PATCH /customer-portal/customers/{selectedCustomerId}/devices/{deviceId}` — inline rename, body `{ name: string | null }`.
- `POST /customer-portal/customers/{selectedCustomerId}/devices/{deviceId}/deactivate` — "Deactivate" button (only enabled while status is `ACTIVE`).
- `DELETE /customer-portal/customers/{selectedCustomerId}/devices/{deviceId}` — "Remove" button.

**Key UI/behavior:** Table: name (click-to-edit inline), platform, status badge (`ACTIVE`→success, `INACTIVE`→outline, `BLOCKED`→destructive), last-seen timestamp. Rename, deactivate, and remove are all **self-service**, no confirmation dialog before delete.

**Edge cases / notes:** "Remove" is a hard `DELETE` with no confirmation step in the UI — clicking it immediately calls the API. The code doesn't distinguish what happens to historical usage/audit data tied to a removed device (that's server-side behavior not visible in this page); the page simply reloads the device list afterward. "Deactivate" is disabled once a device isn't `ACTIVE` (i.e. can't deactivate an already-inactive/blocked device from here).

---

## /portal/usage

**Purpose:** Shows usage-based entitlement consumption (e.g. API calls, seats used) for the selected customer relationship, as progress bars.

**Access requirements:** Authenticated customer session, scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/customers/{selectedCustomerId}/usage` — loaded on mount.

**Key UI/behavior:** Read-only. One card per entitlement showing used/limit (or "Unlimited"), a progress bar that turns red at ≥90% of limit, and remaining count when applicable.

**Edge cases / notes:** No actions; unlimited entitlements render a full green bar rather than a percentage.

---

## /portal/notifications

**Purpose:** Account-wide notification inbox (not scoped to a single customer relationship).

**Access requirements:** Authenticated customer session. **Not** scoped to `selectedCustomerId` — calls `/customer-portal/me/notifications`, i.e. notifications span all of the user's customer relationships.

**API calls:**

- `GET /customer-portal/me/notifications?cursor=&unreadOnly=` — cursor-paginated list, filterable to unread only.
- `POST /customer-portal/me/notifications/{id}/read` — "Mark read" per item.
- `POST /customer-portal/me/notifications/read-all` — "Mark all read".

**Key UI/behavior:** "Unread only" checkbox filter. Each notification shows title, "New" badge if unread, type badge, message body, timestamp. Mark-read actions are self-service and immediate (no confirmation).

**Edge cases / notes:** Unlike almost every other portal page, this one is deliberately account-scoped rather than per-customer-relationship — a notification from any vendor/app the user is a customer of shows up here regardless of which relationship is currently selected in the switcher (the switcher is still rendered in the nav for navigation consistency, but doesn't filter this page's data).

---

## /portal/security

**Purpose:** Account-wide security center: change password, set up/disable two-factor authentication, view and revoke active sessions, view recent account activity.

**Access requirements:** Authenticated customer session. Account-wide — calls `/customer-portal/me/security` and `/auth/*`, not scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/me/security` — loads `CustomerSecurityInfo` (2FA status, sessions, recent activity) on mount.
- `POST /auth/change-password` — body `{ currentPassword, newPassword }`; note this is the shared `/auth` endpoint, not under `/customer-portal`.
- `POST /customer-portal/me/security/two-factor/setup` — starts 2FA enrollment, returns `{ otpauthUrl, secret }`.
- `POST /customer-portal/me/security/two-factor/verify` — body `{ code }`; confirms enrollment and returns one-time recovery codes.
- `POST /customer-portal/me/security/two-factor/disable` — body `{ code }`; requires a valid 6-digit code to turn 2FA off.
- `DELETE /auth/sessions/{sessionId}` — "Revoke" per session row.

**Key UI/behavior:** All actions are self-service. Password change requires current password + new password (min length 12 enforced client-side). 2FA flow: Setup → shows QR/otpauth URL + secret (via `CopyableSecret`) → Verify with 6-digit code → one-time display of recovery codes. Disabling 2FA requires entering a fresh 6-digit code. Active sessions table shows device name/user agent/IP/last-used with a "Revoke" button per row (no confirmation dialog). Recent activity is a read-only audit log list.

**Edge cases / notes:** Recovery codes are shown **exactly once**, immediately after verification — the UI text explicitly warns "They will not be shown again," and there is no way to re-view or regenerate them from this page. Revoking a session has no confirmation step; revoking the session the user is currently using would presumably log them out (not handled specially by this page). This page (like Notifications) is account-wide, not per-customer-relationship — makes sense since login credentials, 2FA, and sessions belong to the person, not to any single vendor relationship.

---

## /portal/settings

**Purpose:** Account-wide profile/preferences editor (name, display name, timezone, language, country, phone). Email shown but not editable here.

**Access requirements:** Authenticated customer session. Account-wide — calls `/customer-portal/me/settings`, not scoped to `selectedCustomerId`.

**API calls:**

- `GET /customer-portal/me/settings` — loads `CustomerSettings` on mount.
- `PATCH /customer-portal/me/settings` — "Save changes", body `{ firstName, lastName, displayName, timezone, language, country, phone }`.

**Key UI/behavior:** Self-service profile edit form. Email field is rendered `disabled` (read-only) — it can't be changed from this form. Country input is a free-text 2-char field, uppercased client-side, not a dropdown.

**Edge cases / notes:** No email-change flow present on this page at all (presumably handled elsewhere, e.g. via registration/verification, or not supported). Like Notifications and Security, this page's data is account-wide rather than per-customer-relationship.
