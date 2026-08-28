# Developer Portal — Payments & Financial Pages

All pages below live under `apps/web/src/app/dashboard` and are wrapped in `<ProtectedRoute>`, which only checks that the user has an authenticated session (`useAuth().status === "authenticated"`) — it redirects to `/login` otherwise and performs no role check itself. Every page also reads the currently-selected organization from `useOrg()` (`apps/web/src/lib/org-context.tsx`), which holds the org list (each with `id`, `name`, `slug`, `role`) and the org-switcher's `selectedOrgId`, persisted in `localStorage` under `ssz.selectedOrgId`. All `/organizations/{orgId}/...` API calls scope data to that selection; none of these pages perform their own client-side role gating based on `selectedOrg.role` — any role enforcement (e.g. restricting who can rotate keys or create refunds) happens server-side in the API, not in the page code itself. Pages nested under `/dashboard/apps/[applicationId]/financial/*` are additionally scoped to one application via the `applicationId` route param and render an `AppNav`.

---

## /dashboard/payment-providers

**Purpose:** Lists the payment providers (e.g. Stripe) configured for the selected organization, as cards showing display name, status, type, and environment.

**Access requirements:** Authenticated + org-scoped only. Not application-scoped.

**API calls:**

- `GET /organizations/{orgId}/payment-providers` — loads the list on mount and whenever `selectedOrgId` changes.

**Key UI/behavior:** Grid of cards linking to each provider's detail page; an "Add provider" button links to the create page. Status badge (`ACTIVE` = success variant, else outline). No filters, no pagination (full list is fetched).

**Edge cases / notes:** None notable.

---

## /dashboard/payment-providers/create

**Purpose:** Form to connect a new payment provider to the organization.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `POST /organizations/{orgId}/payment-providers` — submits `{ type, displayName, environment, config }`; on success redirects to `/dashboard/payment-providers/{id}`.

**Key UI/behavior:** Fields: Type (select, from `PAYMENT_PROVIDER_TYPES`), Display name (required, max 150), Environment (select, from `PAYMENT_ENVIRONMENT_MODES`, defaults to `SANDBOX`), and an optional free-form Config textarea that must be valid JSON (parsed client-side with `JSON.parse`; a parse failure blocks submission with an inline error before any request is made). No confirmation dialog (non-destructive creation).

**Edge cases / notes:** Credentials are explicitly **not** collected here — the form's helper text says they're added afterward from the provider's detail page. Default environment is `SANDBOX`, not live/production, so new providers are sandboxed unless changed.

---

## /dashboard/payment-providers/[providerId]

**Purpose:** Detail/management page for one payment provider: edit display name/status, manage connected external accounts, and manage credentials (API keys/secrets).

**Access requirements:** Authenticated + org-scoped (uses `selectedOrgId` for the provider itself). Not application-scoped.

**API calls:**

- `GET /organizations/{orgId}/payment-providers/{providerId}` — load provider.
- `GET /payment-providers/{providerId}/accounts` — load connected accounts (org-independent path).
- `GET /payment-providers/{providerId}/credentials` — load credential metadata.
- `PATCH /organizations/{orgId}/payment-providers/{providerId}` — save `{ displayName, status }`.
- `POST /organizations/{orgId}/payment-providers/{providerId}/archive` — archive the provider.
- `POST /payment-providers/{providerId}/accounts` — add a connected account `{ externalAccountId, label? }`.
- `POST /payment-providers/{providerId}/credentials` — upsert a credential `{ key, value }` (used both for adding a new key and rotating an existing one, since it's a POST-as-upsert, not a distinct "rotate" endpoint).
- `DELETE /payment-providers/{providerId}/credentials/{credentialId}` — remove a credential.

**Key UI/behavior:**

- "Save changes" updates display name and status (`ACTIVE`/`DISABLED` select).
- "Archive provider" button appears only when `status === "ACTIVE"`; clicking calls the archive endpoint immediately — **no confirmation dialog** despite this being a status-changing, hard-to-casually-reverse action for a payment provider.
- Connected accounts table + inline add form (external account ID + optional label).
- Credentials table shows only key, last-four, and rotation timestamp — the plaintext secret is never displayed after saving (per explicit UI copy: "Secret values are never shown after they're saved"). Adding/saving a credential value has **no confirmation dialog**; "Remove" on an existing credential also fires immediately with **no confirmation dialog**.

**Edge cases / notes:** Credential value input uses `type="password"` and `autoComplete="off"`, max length 8000. Because credential POST is an upsert keyed by `key`, submitting the same key again silently rotates/overwrites the previous secret with no distinct "rotate" confirmation step — worth flagging since this is a financially-sensitive, effectively-irreversible action (old secret becomes unrecoverable) with no guard rail in the UI.

---

## /dashboard/payment-methods

**Purpose:** Lists stored payment methods for the organization's customers (card/bank details metadata) and allows removing one.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/payment-methods` — load list.
- `DELETE /organizations/{orgId}/payment-methods/{paymentMethodId}` — remove a method.

**Key UI/behavior:** Table with type, brand, last 4, default flag, status badge, expiry. A "Remove" button appears only for `ACTIVE` methods and fires the DELETE immediately — **no confirmation dialog** before removing a stored payment method.

**Edge cases / notes:** None further.

---

## /dashboard/payment-webhooks

**Purpose:** Read-only log of inbound webhook events received from payment providers (e.g. Stripe events hitting this platform), with provider filtering.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/payment-providers` — populates the provider filter dropdown.
- `GET /organizations/{orgId}/payment-webhooks?providerId={id}` — loads webhook events, re-fetched whenever the provider filter changes (`providerId` query param omitted when "All providers" is selected).

**Key UI/behavior:** Filter by provider (select). Table: event type, normalized type, status badge, truncated error message, received/processed timestamps. No actions (fully read-only), no pagination — full result set per filter.

**Edge cases / notes:** This page is distinct from `/dashboard/webhooks` — this one shows **inbound** provider webhook events (raw ingestion log), whereas `/dashboard/webhooks` manages **outbound** delivery endpoints this platform sends events to.

---

## /dashboard/checkout-sessions

**Purpose:** Lists hosted checkout sessions created for customers against a provider/price.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/checkout-sessions` — load list.

**Key UI/behavior:** Table: customer (links to session detail), provider ID, status badge (`COMPLETE` = success), expiry, created date. "Create checkout session" button links to the create page. No filters/pagination.

**Edge cases / notes:** None notable.

---

## /dashboard/checkout-sessions/create

**Purpose:** Form to start a new hosted checkout session for a customer against a chosen provider and price.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/payment-providers`, `GET /organizations/{orgId}/customers?limit=100`, `GET /organizations/{orgId}/products?limit=100` — loaded together on mount via `Promise.all` to populate the form's dropdowns.
- `GET /products/{productId}/plans?limit=100` — loaded when a product is selected (resets plan/price selection).
- `GET /plans/{planId}/prices?limit=100` — loaded when a plan is selected (resets price selection).
- `POST /organizations/{orgId}/checkout-sessions` — creates the session with `{ providerId, customerId, priceId, productId?, planId?, successUrl?, cancelUrl? }`; redirects to the session's detail page on success.

**Key UI/behavior:** Cascading selects: Provider → Customer → Product → Plan (disabled until a product is chosen) → Price (disabled until a plan is chosen, shown as `{currency} {amountMinor} minor / {interval}`). Optional Success URL / Cancel URL (`type="url"` inputs). Client-side validation requires provider, customer, and price before submit. No confirmation dialog (session creation is not destructive).

**Edge cases / notes:** Product and plan are optional in the payload — only `providerId`, `customerId`, and `priceId` are strictly required by the form's own validation, even though the UI walks through product/plan to help pick a price.

---

## /dashboard/checkout-sessions/[checkoutSessionId]

**Purpose:** Read-only detail view of a single checkout session.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/checkout-sessions/{checkoutSessionId}` — load session.

**Key UI/behavior:** Shows checkout URL (external link), provider reference, price/product/plan/subscription IDs, expiry, completed/created timestamps, and a status badge. No actions — fully read-only page.

**Edge cases / notes:** None notable.

---

## /dashboard/transactions

**Purpose:** Lists payment transactions (actual charge attempts) for the organization.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/transactions` — load list.

**Key UI/behavior:** Table: customer (links to detail), provider ID, amount (via `formatMinorUnits`), status badge (via `transactionStatusVariant`), created date. No filters/pagination.

**Edge cases / notes:** None notable.

---

## /dashboard/transactions/[transactionId]

**Purpose:** Detail page for a single transaction: overview, manual reconciliation ("mark succeeded"), refund creation, and nested history of attempts, refunds, and disputes.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/transactions/{transactionId}` — load transaction (includes `attempts`, `refunds`, `disputes` arrays).
- `POST /organizations/{orgId}/transactions/{transactionId}/mark-succeeded` — manually mark a `PENDING` transaction as succeeded (button only shown when status is `PENDING`).
- `POST /organizations/{orgId}/transactions/{transactionId}/refunds` — create a refund `{ amountMinor?, reason? }`.

**Key UI/behavior:**

- "Mark succeeded" — shown only for `PENDING` transactions, described as being "to reconcile a manually recorded or bank transfer payment." Fires immediately on click with **no confirmation dialog**.
- Refund form — amount in minor units (optional; leaving blank issues a full refund per placeholder text "Full refund") and an optional reason (max 500 chars). Submitting calls the refund endpoint immediately with **no confirmation dialog** — this is the most financially consequential action on this page (moves money back to the customer) and has zero guard rail beyond the form submit itself.
- Read-only tables below: Attempts (attempt #, status, failure message, timestamp), Refunds (amount, status badge, reason, created), Disputes (amount, status badge, reason, created).

**Edge cases / notes:** Refund amount defaults to a full refund when left blank (partial refunds supported via the amount field). No idempotency-key input is exposed in the UI for refund creation — if the underlying API requires one, it isn't surfaced here, so a network retry could theoretically double-submit from the user's perspective (not verifiable from this file alone).

---

## /dashboard/refunds

**Purpose:** Organization-wide read-only list of all refunds (across transactions).

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/refunds` — load list.

**Key UI/behavior:** Table: transaction (links to transaction detail), amount, status badge (`SUCCEEDED` = success), reason, created date. No actions here — refund creation only happens from the transaction detail page. No filters/pagination.

**Edge cases / notes:** None notable.

---

## /dashboard/disputes

**Purpose:** Organization-wide read-only list of payment disputes (chargebacks).

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/disputes` — load list.

**Key UI/behavior:** Table: transaction (links to dispute detail), amount, status badge (via `disputeStatusVariant`), reason, created date. No filters/pagination, no actions.

**Edge cases / notes:** None notable.

---

## /dashboard/disputes/[disputeId]

**Purpose:** Read-only detail view of a single dispute.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/disputes/{disputeId}` — load dispute.

**Key UI/behavior:** Shows provider dispute ID, reason, evidence-due-by date, created date, and a status badge. **No actions at all** — there is no way to respond to a dispute, submit evidence, or accept/contest it from this UI; it's purely informational.

**Edge cases / notes:** Since there's no evidence-submission flow in the web app, dispute response presumably happens directly with the payment provider (e.g. Stripe dashboard) outside this platform — worth confirming with the team if that's intentional.

---

## /dashboard/invoices

**Purpose:** Organization-wide read-only list of invoices.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/invoices` — load list.

**Key UI/behavior:** Table: customer (links to detail), amount due, amount paid, status badge (via `invoiceStatusVariant`), created date. No filters/pagination, no actions.

**Edge cases / notes:** None notable.

---

## /dashboard/invoices/[invoiceId]

**Purpose:** Read-only detail view of a single invoice.

**Access requirements:** Authenticated + org-scoped only.

**API calls:**

- `GET /organizations/{orgId}/invoices/{invoiceId}` — load invoice.

**Key UI/behavior:** Shows provider ID, provider invoice ID, subscription ID, amount paid, billing period (start → end), issued/paid timestamps, and a status badge. No actions — fully read-only.

**Edge cases / notes:** None notable.

---

## /dashboard/webhooks

**Purpose:** Manages **outbound** webhook endpoints — i.e. URLs this platform delivers event notifications to — per application, including creating endpoints, toggling enabled/disabled, rotating the signing secret, and deleting.

**Access requirements:** Authenticated + org-scoped, and **application-scoped** via an in-page Application selector (not a route param — it's a `Select` populated from the org's applications, defaulting to the first application).

**API calls:**

- `GET /organizations/{orgId}/applications` — populates the application selector.
- `GET /applications/{applicationId}/environments` — populates the optional environment selector for endpoint creation.
- `GET /applications/{applicationId}/webhook-endpoints` — loads endpoints for the selected application.
- `POST /applications/{applicationId}/webhook-endpoints` — creates an endpoint `{ url, description?, eventTypes[], environmentId? }`; response includes `secret.plainText` shown once.
- `POST /applications/{applicationId}/webhook-endpoints/{id}/enable` or `/disable` — toggles status.
- `DELETE /applications/{applicationId}/webhook-endpoints/{id}` — deletes an endpoint.
- `POST /applications/{applicationId}/webhook-endpoints/{id}/secret/rotate` — rotates the signing secret; response's `plainText` shown once.

**Key UI/behavior:**

- Endpoint table shows URL, event types (first 3 + "+N" badge), status badge, and row actions: Enable/Disable, **Rotate secret**, **Delete** — all three fire their respective API call **immediately on click with no confirmation dialog**, including secret rotation (which invalidates the old signing secret for anyone still using it) and deletion (irreversible).
- New-signing-secret display: after creation or rotation, the plaintext secret is shown once in an `Alert` via a `CopyableSecret` component with explicit copy "copy it now, it will not be shown again."
- Create-endpoint form requires URL and at least one selected event type (checkboxes from `WEBHOOK_EVENT_TYPES`); optional description and environment scoping.

**Edge cases / notes:** Rotate/Delete having zero confirmation step is the notable risk here — rotating breaks any consumer still validating signatures with the old secret, and deleting an endpoint is not undoable from this UI. Endpoint selection for delivery detail carries `applicationId` forward as a query string (`?applicationId=...`) rather than a route segment.

---

## /dashboard/webhooks/[webhookEndpointId]

**Purpose:** Shows delivery history for one webhook endpoint, with filtering, a payload/response inspector, and retry for failed deliveries.

**Access requirements:** Authenticated only in terms of route guard; relies on `applicationId` passed as a **query parameter** (`?applicationId=...`, read via `useSearchParams`) rather than a route segment — the endpoint fetch is skipped entirely if that query param is absent.

**API calls:**

- `GET /applications/{applicationId}/webhook-endpoints/{webhookEndpointId}` — load endpoint summary (requires the `applicationId` query param).
- `GET /webhook-endpoints/{webhookEndpointId}/deliveries?cursor=&status=&eventType=` — cursor-paginated delivery list; refetched on filter change.
- `GET /webhook-endpoints/{webhookEndpointId}/deliveries/{deliveryId}` — load one delivery's full detail (payload, response body, retries) when a row is clicked.
- `POST /webhook-endpoints/{webhookEndpointId}/deliveries/{deliveryId}/retry` — retries a failed/exhausted delivery.

**Key UI/behavior:** Status filter (`PENDING`/`SUCCESS`/`FAILED`/`RETRYING`/`EXHAUSTED`) and free-text event-type filter. Cursor-based "Load more" pagination (appends to existing list). Clicking a delivery row expands full JSON payload and response body in `<pre>` blocks, plus a retries sub-table. "Retry" button appears only when the selected delivery's status is `FAILED` or `EXHAUSTED`, and fires immediately with **no confirmation dialog** (low risk — retry is idempotent-ish in effect, just re-delivers).

**Edge cases / notes:** Because `applicationId` is carried via query string rather than being embedded in the route, navigating directly to this URL without that param silently no-ops the endpoint fetch (deliveries endpoint itself doesn't need it, since delivery lookups are keyed by `webhookEndpointId` alone).

---

## /dashboard/apps/[applicationId]/financial

**Purpose:** Per-application "Financial System" settings: choose between Internal Finance and an external LedGix ERP integration, configure/test the ERP connection, rotate its API key, view sync status, and manage ERP resource permissions.

**Access requirements:** Authenticated + org-scoped (`selectedOrgId`) + **application-scoped** via the `[applicationId]` route param (rendered inside `AppNav`). The in-page docs mention "Organization Owner or Administrator role" as a prerequisite for managing this tab, but that is documentation copy only — no client-side role check gates the page itself; enforcement, if any, is server-side.

**API calls:**

- `GET /organizations/{orgId}/financial-integration` — load current integration config (provider + ERP connection, if any).
- `PUT /organizations/{orgId}/financial-integration` — switch provider `{ provider: "INTERNAL" | "LEDGIX_ERP" }`.
- `POST /organizations/{orgId}/financial-integration/erp-connection` — create the ERP connection `{ baseUrl, companyId, apiKey }` (only when none exists yet).
- `PATCH /organizations/{orgId}/financial-integration/erp-connection` — update `{ baseUrl, companyId }` only (does not touch the key) when a connection already exists.
- `POST /organizations/{orgId}/financial-integration/erp-connection/test` — tests the live connection, returns `{ status: CONNECTED | FAILED, ... }`.
- `POST /organizations/{orgId}/financial-integration/erp-connection/rotate-key` — rotates the API key `{ apiKey }`.
- `DELETE /organizations/{orgId}/financial-integration/erp-connection` — disconnects/removes the ERP connection.
- `GET /organizations/{orgId}/financial-sync/status` — sync status summary (pending/retrying/dead-letter counts); failures here are swallowed non-fatally (only shown if `integration.provider === "LEDGIX_ERP"`).
- `GET /organizations/{orgId}/financial-integration/erp-connection/permissions` — load per-resource read/write permission grid (only fetched when an ERP connection exists).
- `PUT /organizations/{orgId}/financial-integration/erp-connection/permissions` — save the permission grid `{ permissions: [{ resource, canRead, canWrite }] }`.

**Key UI/behavior:**

- Provider picker: two clickable cards (Internal Finance vs. LedGix ERP); switching calls the PUT immediately with **no confirmation dialog**, even though switching away from LEDGIX_ERP effectively stops future sync (see edge cases).
- ERP connection form: Base URL, Company ID, and API Key (API Key field only rendered/required on first-time connect; once connected it disappears from this form and only "Rotate API key" can change it).
- "Test connection" button shows a `CONNECTED`/`FAILED` result inline (with company name/currency on success).
- "Rotate API key" — separate form/button, fires the rotate-key call **with no confirmation dialog**; this replaces the stored key immediately.
- "Disconnect ERP" — ghost button, fires the DELETE immediately with **no confirmation dialog**, despite disconnecting removing the stored credentials entirely.
- Permissions matrix: checkbox grid (`ERP_RESOURCE_TYPES` × Read/Write) with an explicit "Save permissions" button (not auto-saved per checkbox).
- Sync status card shows pending/retrying/dead-letter counts and a link to sync history.

**Edge cases / notes:** Per the in-page LedGix docs, there is **no delete permission** anywhere in this integration by design — write access can create/update records in the ERP but the sync pipeline never deletes ERP-side records. Switching provider or disconnecting is **not retroactive**: existing internally-tracked `PaymentInvoice`/`PaymentReceipt` records are not backfilled or migrated when switching providers; only new `FinancialEvent`s after the switch follow the newly selected provider. Disconnecting while events are pending/retrying causes those events to fail and surface in Sync History rather than silently vanishing. Only one ERP company can be connected per organization at a time.

---

## /dashboard/apps/[applicationId]/financial/docs

**Purpose:** Static, in-app documentation page walking through connecting LedGix ERP end-to-end (prerequisites, install, company/API-key setup, connecting, testing, permissions, security, troubleshooting, migration notes, FAQ, and raw API examples).

**Access requirements:** Authenticated only (`ProtectedRoute`); application-scoped via the route param (used only to build the "back to Financial" link and render `AppNav`) — this page makes no API calls of its own and doesn't depend on `selectedOrgId`.

**API calls:** None — pure static content page.

**Key UI/behavior:** Table-of-contents anchor links to each section. No forms, no destructive actions — informational only.

**Edge cases / notes:** Documents behavior worth cross-referencing against the live financial page: the security-best-practices section recommends periodic key rotation (e.g. every 90 days) and least-privilege permission grants; the migration section reiterates that provider switches are not retroactive; the FAQ notes only organization staff (not customers) can change the financial provider, and that the customer portal shows sync status/ERP reference numbers on transactions once synced.

---

## /dashboard/apps/[applicationId]/financial/sync-history

**Purpose:** Lists the history of `FinancialEvent` sync attempts to the connected ERP, with status filtering and per-item retry.

**Access requirements:** Authenticated + org-scoped + application-scoped (route param, used for the "back to Financial" link and `AppNav`, though the actual data fetch is keyed by `selectedOrgId` rather than `applicationId`).

**API calls:**

- `GET /organizations/{orgId}/financial-sync/history?cursor=&status=` — cursor-paginated list.
- `POST /organizations/{orgId}/financial-sync/history/{id}/retry` — retries one failed/dead-lettered sync record.

**Key UI/behavior:** Status filter select (`PENDING`/`RETRYING`/`SYNCED`/`FAILED`/`DEAD_LETTER`, plus "All statuses"). Table: event ID (links to detail), status badge, attempt count, ERP reference number, created date, and a "Retry" button shown only for `FAILED`/`DEAD_LETTER` rows. Cursor-based "Load more" pagination (appends). Retry fires immediately with **no confirmation dialog** (low risk — re-attempts a sync, doesn't move money).

**Edge cases / notes:** None further beyond what's noted on the parent Financial page.

---

## /dashboard/apps/[applicationId]/financial/sync-history/[financialSyncId]

**Purpose:** Detail view of a single financial sync record: overview, the underlying `FinancialEvent` payload, last error (if any), and full attempt history.

**Access requirements:** Authenticated + org-scoped + application-scoped (route params for both `applicationId` and `financialSyncId`).

**API calls:**

- `GET /organizations/{orgId}/financial-sync/history/{financialSyncId}` — load detail.
- `POST /organizations/{orgId}/financial-sync/history/{financialSyncId}/retry` — retry, shown only when status is `FAILED` or `DEAD_LETTER`.

**Key UI/behavior:** Overview card (provider, attempt count, ERP reference, created/completed timestamps), Financial Event card (type + raw JSON payload in a `<pre>` block), conditional Last Error card (error message, timestamp, resolved/unresolved), and an Attempt History table (per-attempt status/error/timestamp). Retry button fires immediately with **no confirmation dialog** (same low-risk profile as the list page).

**Edge cases / notes:** None further.

---

### Summary

20 pages documented, covering payment providers (list/create/detail), payment methods, payment webhooks (inbound), checkout sessions (list/create/detail), transactions (list/detail with refund + manual-succeed actions), refunds (list), disputes (list/detail — read-only, no response flow), invoices (list/detail), outbound webhooks (list/detail with secret rotation and delivery retry), and the per-application Financial/ERP integration (settings, static docs, sync history list/detail).

The most financially/security-sensitive actions with **no confirmation dialog** in the current code:

- Refund creation (`/dashboard/transactions/[transactionId]`)
- Provider archive (`/dashboard/payment-providers/[providerId]`)
- Credential add/rotate/remove (`/dashboard/payment-providers/[providerId]`)
- Payment method removal (`/dashboard/payment-methods`)
- Webhook endpoint secret rotation and deletion (`/dashboard/webhooks`)
- ERP API key rotation and ERP disconnect (`/dashboard/apps/[applicationId]/financial`)
- Provider switch between Internal Finance and LedGix ERP (`/dashboard/apps/[applicationId]/financial`)
