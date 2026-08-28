# User Journeys: Customer, Vendor, Developer

This doc walks through the three main ways someone uses the SS Zentronics Platform, and which pages (documented in the other files in this folder) they touch along the way. It's a map, not a spec — some pages listed below may turn out not to apply cleanly to a given role; those are flagged inline as **(TBD)** for follow-up discussion rather than silently resolved here.

Three roles, three very different relationships to the platform:

- **Customer** — an end user who buys a subscription/license to an app built on the platform. Lives in `/portal/**`.
- **Vendor** — an organization that builds and sells an app/product through the platform (an `Organization` in the data model). Lives in `/dashboard/**` and shows up in the public storefront at `/marketplace/**`.
- **Developer** — a vendor's technical member (or a separate integrator) who wires their own external app to the platform's API for checkout, licensing, and entitlements. Also lives in `/dashboard/**`, but the destination of their work is _outside_ this app — in their own product.

A single person can hold more than one of these roles (a vendor's founder is usually also the "developer" configuring API keys), so the split below is by _task_, not by literal user account type.

---

## Customer journey

1. **Discover** — browse [`/marketplace`](marketplace-storefront.md#marketplace) or land directly on an app's page via [`/marketplace/[applicationSlugOrId]`](marketplace-storefront.md#marketplaceapplicationslugorid), no login required. Only `PUBLISHED` + `PUBLIC` listings are visible here.
2. **Create an account** — [`/register`](auth.md#register) (email/password or Google OAuth). Registration auto-verifies the account; there's no email-confirmation step to complete.
3. **Evaluate** — read reviews on the app detail page; writing a review requires being logged in _and_ having an existing `Customer` record for that specific application (i.e., you generally need to have bought it first).
4. **Purchase** — this is the one step that currently has a gap in this repo: there's no generic "Buy" button wired up from the public storefront into a hosted checkout page here. In practice, purchasing today happens through the vendor's own app/website calling the platform's checkout APIs on the customer's behalf. **(TBD — see the `marketplace` repo's `/checkout/[intentId]` page, which fills this gap with a vendor-agnostic hosted checkout; whether/how that gets reintroduced here is an open question.)**
5. **Manage the purchase** — after buying, everything lives in the customer portal: [`/portal`](portal.md) for an overview, `/portal/subscriptions` to view/cancel/change plan, `/portal/invoices` and `/portal/receipts` for billing history, `/portal/licenses` and `/portal/devices` for activation management, `/portal/usage` for metered usage, `/portal/security` and `/portal/settings` for account/session management, `/portal/organizations` to switch between different vendors' apps they're a customer of.

Pages **not applicable** to a customer: all of `/dashboard/**` and `/admin/**` — those require org membership or platform-admin status respectively.

---

## Vendor journey

A vendor is an `Organization` selling one or more apps. This is the primary audience for `/dashboard/**`.

1. **Create an account** — [`/register`](auth.md#register), same as a customer.
2. **Get an organization** — every dashboard page is scoped to a "currently selected organization" via the org-switcher. **(TBD — the exact org-creation flow, e.g. auto-created on first login vs. an explicit "create organization" step, needs to be confirmed and documented once we revisit this.)**
3. **Register the app/product** — [`/dashboard/apps/create`](dashboard-core.md#dashboardappscreate), then configure it: `settings`, `domains`, `environments`, `secrets`, `versions`, `members` (invite teammates).
4. **Build the pricing model** — [`/dashboard/products/create`](dashboard-core.md#dashboardproductscreate) → define plans/prices, plus `/dashboard/coupons`, `/dashboard/trials`, `/dashboard/features` and `/dashboard/entitlements` for feature-gating.
5. **Connect a way to get paid** — [`/dashboard/payment-providers/create`](dashboard-payments.md#dashboardpayment-providerscreate) (Stripe/PayPal/Apple/Google Play/Easypaisa/JazzCash/manual/bank transfer). Whether a vendor plugs in their own provider credentials or transacts through the platform's shared provider (with the platform taking a commission and later paying the vendor out) depends on which model this deployment uses — **(TBD, ties into the commission/payout model — discuss which is the default.)**
6. **Go public** — [`/dashboard/apps/[applicationId]/listing`](dashboard-core.md#dashboardappsapplicationidlisting) is what actually publishes the app to `/marketplace`. Nothing shows up in the storefront until this is filled in and set to published/public.
7. **Run the business** — track buyers at `/dashboard/customers`, active subscriptions at `/dashboard/subscriptions`, money movement at `/dashboard/transactions`, `/dashboard/refunds`, `/dashboard/disputes`, `/dashboard/invoices`.
8. **Get paid out** — vendors don't currently have a self-serve payouts page in this repo; payout processing is platform-admin-only (see `/admin/payments` and the financial-integrations/ERP sync pages). **(TBD — worth deciding whether vendors need their own read-only payout history view.)**

Pages **not applicable** to a vendor: `/portal/**` (unless the vendor is _also_ a customer of a different app on the platform) and all of `/admin/**` (platform-staff only).

---

## Developer journey

The "developer" here is the technical counterpart to the vendor — someone wiring their _own separate application_ (e.g. an expense tracker, a mobile app) to use this platform as its subscription/licensing/payments backend, rather than selling through the public storefront at all.

1. **Create an account + organization** — same first two steps as the vendor journey above.
2. **Register the app being integrated** — [`/dashboard/apps/create`](dashboard-core.md#dashboardappscreate) still applies (the "application" represents their external product), but they'll likely skip the storefront `listing` page entirely since they're not selling through the marketplace UI.
3. **Get API credentials** — [`/dashboard/api-keys`](dashboard-dev-tools.md#dashboardapi-keys) → create an API client, copy the generated key (shown once, never retrievable again).
4. **Read the integration docs** — [`/dashboard/api-docs`](dashboard-dev-tools.md#dashboardapi-docs) (interactive Swagger UI).
5. **Define what's being sold** — same `/dashboard/products` + plans/prices setup as a vendor.
6. **Wire up checkout from their own app** — this is the core of the "embed paywall's checkout" pattern: their backend calls the platform's API (using the API key) to start a checkout for a specific customer/plan, then sends the customer to a hosted checkout page to complete payment. **This hosted public checkout page does not currently exist in this repo** — it lives in the `marketplace` repo as `/checkout/[intentId]` (see that repo's `docs/pages/checkout-widget.md`). **(TBD — whether this gets reintroduced here.)**
7. **Receive events back** — [`/dashboard/webhooks`](dashboard-payments.md#dashboardwebhooks) to register an endpoint and get notified of payment/subscription lifecycle events in their own backend.
8. **Gate features in their app** — `/dashboard/entitlements`, `/dashboard/features`, `/dashboard/usage` drive what the integrating app allows a given customer to do.
9. **Reconcile financials** — `/dashboard/apps/[applicationId]/financial` and its sync-history sub-pages show the ERP (LedGix) sync status for this app's transactions.

Pages **not applicable** to a developer: `/portal/**`, `/admin/**`, and (in this repo) the marketplace-storefront listing flow if they're not selling publicly.

---

## Platform Owner journey (SS Zentronics)

This is the internal, platform-admin role — SS Zentronics staff, not a customer/vendor/developer. It's the only role that spans and oversees the other three rather than living inside one of them. Everything here is gated by `/admin/layout.tsx`'s platform-admin check (see [admin-core.md](admin-core.md)).

1. **Login** — there's no separate admin login page; a platform owner uses the exact same [`/login`](auth.md#login) as everyone else. What makes them an admin is a flag on their `User` record, granted via [`/admin/settings`](admin-core.md#adminsettings) by an existing platform admin (or seeded directly in the database for the first one). Once logged in, `/admin/**` simply becomes reachable instead of redirecting away.
2. **See the big picture** — [`/admin/executive-dashboard`](admin-financial.md#adminexecutive-dashboard) for top-line business KPIs (revenue, growth, active subscriptions) and [`/admin/platform-intelligence`](admin-financial.md#adminplatform-intelligence) for deeper BI/marketplace-performance signals across the whole platform.
3. **Drill into a specific vendor** — [`/admin/organizations`](admin-core.md#adminorganizations) → [`/admin/organizations/[organizationId]`](admin-core.md#adminorganizationsorganizationid) for that org's own apps, revenue, and status; [`/admin/applications/[applicationId]`](admin-core.md#adminapplicationsapplicationid) for a single app's numbers.
4. **Drill into a specific customer** — [`/admin/customers/[customerId]`](admin-core.md#admincustomerscustomerid) — also where account-recovery/impersonation tools live if a customer needs support.
5. **Drill into a specific developer/integration** — there isn't a dedicated "developer performance" view; the closest equivalents are the application detail page above (shows API/webhook activity for that app) and [`/admin/audit-center`](admin-ops.md#adminaudit-center) for who did what via the API. **(TBD — if per-developer/API-client usage analytics are wanted as a first-class view, that doesn't exist yet.)**
6. **Pull a formal report** — [`/admin/reports`](admin-financial.md#adminreports) for live, synchronous dashboard-style reports, or [`/admin/report-requests`](admin-financial.md#adminreport-requests) to generate and download a report file asynchronously for deeper offline analysis.

### Getting notified of errors, bugs, or something broken

There's no single "alerts inbox" — monitoring here is spread across a few purpose-built pages, and there is **no automated broken-link checker or synthetic uptime monitor** in this repo today:

- [`/admin/system-health`](admin-ops.md#adminsystem-health) — the one page that auto-refreshes (every 20s); shows live API/webhook/ERP-sync/queue/worker/db/cache status. This is the closest thing to a real-time "is anything on fire" view.
- [`/admin/job-queues`](admin-ops.md#adminjob-queues) — background job queues, including a `DEAD_LETTER` status for jobs that exhausted their retries and need manual attention (a strong signal something's broken).
- [`/admin/erp-status`](admin-financial.md#adminerp-status) — specifically whether the LedGix financial sync is healthy or falling behind/erroring.
- [`/admin/events`](admin-ops.md#adminevents) → [`/admin/events/[eventId]`](admin-ops.md#admineventseventid) — the raw platform event bus feed, useful for tracing exactly what happened around an incident.
- [`/admin/audit-center`](admin-ops.md#adminaudit-center) — audit trail of admin/user actions, for after-the-fact investigation.
- [`/admin/fraud-center`](admin-ops.md#adminfraud-center) — flagged suspicious activity specifically (not general errors).
- [`/admin/automation-rules`](admin-ops.md#adminautomation-rules) — can be configured to react to platform events (e.g. a payment failure or sync error) and trigger a notification, but this has to be set up deliberately; it's not a built-in alerting system out of the box.
- [`/admin/notifications`](admin-ops.md#adminnotifications) / [`/admin/notification-templates`](admin-ops.md#adminnotification-templates) — the delivery mechanism for notifications _to_ users, which can be repurposed for internal alerting via an automation rule, but isn't itself a monitoring tool.

**(TBD — if you want proactive push/email/Slack alerting on errors rather than having to check these dashboards, that's a gap: today it's pull-based, built on `/admin/automation-rules` at best, with no external paging integration.)**

Pages **not applicable** to a platform owner acting in this role: none — `/admin/**` is built entirely for this role, though a platform owner could separately also hold a vendor or customer account.

---

## Summary table

| Page area                                      | Customer                   | Vendor                     | Developer                              | Platform Owner |
| ---------------------------------------------- | -------------------------- | -------------------------- | -------------------------------------- | -------------- |
| `/marketplace/**` (storefront)                 | ✅ browse/buy/review       | ✅ gets listed here        | — (TBD, usually skipped)               | —              |
| `/portal/**`                                   | ✅ home turf               | — (unless also a customer) | —                                      | —              |
| `/dashboard/**` (core, products, customers)    | —                          | ✅ home turf               | ✅ shared with vendor                  | —              |
| `/dashboard/**` (payments, providers)          | —                          | ✅                         | ✅ (as the checkout integration point) | —              |
| `/dashboard/**` (api-keys, api-docs, oauth)    | —                          | optional                   | ✅ home turf                           | —              |
| `/checkout/[intentId]` (marketplace repo only) | ✅ completes purchase here | —                          | ✅ is what they redirect customers to  | —              |
| `/admin/**`                                    | —                          | —                          | —                                      | ✅ home turf   |

Anything marked **(TBD)** above is a known open question, not an error in the underlying docs — flagging for the next pass rather than guessing.
