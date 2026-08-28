# Platform Admin - Financial & BI Pages

This entire section lives under `/admin/*` in `apps/web` and is internal-only:
every route is wrapped by `apps/web/src/app/admin/layout.tsx`, which gates access
client-side (with the API's `/admin/*` routes as the real source of truth, 403ing
for non-admins). See that file for the gating logic; it isn't repeated per-page
below.

The pages covered here are the ERP/financial-integration views, platform-wide
payments oversight, two distinct reporting features, and the executive/BI
dashboards.

---

## /admin/financial-integrations

**Purpose:** Lists ERP / financial-provider connection status (e.g. QuickBooks,
Xero, etc.) for every organization on the platform, one row per org+provider.

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/financial-integrations` - initial load.
- `GET /admin/financial-integrations?cursor=<cursor>` - "Load more" pagination.

**Key UI/behavior:** Table of Organization (links to `/admin/organizations/:id`),
Provider, Status badge (`CONNECTED` = success, `FAILED`/`DISCONNECTED` =
destructive, `PENDING_TEST` = outline), and Last synced timestamp (`"never"` if
null). Cursor-based "Load more" button appends to the existing list. Links to
`/admin/erp-status` for sync queues/retries.

**Edge cases / notes:** Purely read-only - no retry or reconnect actions live on
this page (those are on ERP Status). No filters.

---

## /admin/erp-status

**Purpose:** Platform-wide financial sync operations view - the queues and raw
event log behind the ERP integrations, with the ability to retry failed syncs.

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/financial/sync/pending` - pending sync queue.
- `GET /admin/financial/sync/dead-letter` - dead-lettered syncs.
- `GET /admin/financial/sync/failed-transactions` - failed transactions.
- `GET /admin/financial/events` - recent raw financial events.
- Each of the above supports `?cursor=<cursor>` for its own "Load more".
- `POST /admin/financial/sync/:id/retry` - triggered by the "Retry" button on a
  Pending or Dead Letter row; reloads that section's list on success.

**Key UI/behavior:** Four independent cards (Pending, Dead Letter, Failed
Transactions, Recent Events), each with its own loading/error state and cursor
pagination. Sync status badges via `syncStatusVariant` (`SYNCED` = success,
`FAILED`/`DEAD_LETTER` = destructive, `PENDING`/`RETRYING` = outline). Failed
Transactions shows amount/currency and failure reason; Recent Events shows
event type and org ID only (no payload rendered).

**Edge cases / notes:** Retry is disabled globally (`retryBusy !== null`) while
any retry is in flight, preventing concurrent retries across rows. No
auto-refresh/polling - all four lists are point-in-time snapshots refreshed
only by retry actions or a manual page reload.

---

## /admin/payments

**Purpose:** Flat list of all payment transactions across every organization
on the platform, with status filtering.

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/payments` (optionally with `?status=<STATUS>&cursor=<cursor>`) -
  load and "Load more".

**Key UI/behavior:** Status filter dropdown (`PENDING`, `AUTHORIZED`,
`CAPTURED`, `SUCCEEDED`, `FAILED`, `CANCELED`, `REFUNDED`,
`PARTIALLY_REFUNDED`, `DISPUTED`, `CHARGEBACK`, or all). Table columns: ID
(mono/truncated), Status badge (`transactionStatusVariant`), Organization,
Amount (minor units + currency, unformatted), Created. Cursor-based "Load
more".

**Edge cases / notes:** Changing the status filter re-runs `load()` from
scratch (does not append) since it's a dependency of the `load` callback.
Amounts are shown as raw minor-unit integers, not formatted currency strings.

---

## /admin/reports

**Purpose:** Live, "always-on" platform-wide reporting dashboard - a grid of
report cards, each independently fetching and rendering its own data as
key/value stats plus a preview table. This is the older, synchronous,
dashboard-style report view (not to be confused with `/admin/report-requests`
below).

**Access requirements:** platform-admin only (see intro).

**API calls:** One `GET /admin/reports/:type` per card, fired independently and
in parallel on mount, for each of: `organizations`, `applications`, `revenue`,
`subscriptions`, `payments`, `erp-integrations`, `api-usage`,
`customer-growth`, `developer-growth`.

**Key UI/behavior:** Each `ReportCard` renders any top-level scalar fields of
the response as a label/value grid, then up to the first 5 columns and first
20 rows of the response's `items` array (if present) as a table. The report
shape is intentionally untyped/generic (`AdminReport` is `[key: string]:
unknown` plus optional `items`) - the UI adapts to whatever fields a given
report type returns rather than modeling each one.

**Edge cases / notes:** No filters, no export, no polling - purely a live
read of current data each time the page loads. Object-valued fields inside
`items` rows are shown via `JSON.stringify`. This page is unrelated to report
generation/export; for downloadable exports see Report Requests below.

---

## /admin/report-requests

**Purpose:** Asynchronous report generation - submit a request for a report
(type + export format, optionally scoped to one organization), then poll the
list and download completed files. Distinct feature from `/admin/reports`
above (that page is a live dashboard; this page is a background export job
queue with downloadable artifacts).

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/report-requests` (optionally `?cursor=<cursor>`) - load list and
  "Load more".
- `POST /admin/report-requests` - submit a new request, body
  `{ type, format, organizationId? }`; reloads the list on success.
- `GET /admin/report-requests/:id/download` - triggered by the "Download"
  button, only enabled when a request's status is `SUCCESS`. Called via raw
  `fetch` (not the shared `authedFetch` helper) with a manual `Authorization:
Bearer <token>` header, since it needs the raw blob response rather than
  JSON; the response is turned into a client-side download via an object URL.

**Key UI/behavior:** Form with Type (`REVENUE`, `SUBSCRIPTIONS`, `CUSTOMERS`,
`APPLICATIONS`, `MARKETPLACE`, `FINANCIAL_SYNC`, `DEVELOPER_ACTIVITY`,
`API_USAGE`, `LICENSE_USAGE`, `STORAGE`), Format (`CSV`, `EXCEL`, `PDF`,
`JSON`), and an optional Organization ID text input. Table of past requests
shows Type, Format, Status badge (`PENDING`/`PROCESSING` = outline, `SUCCESS`
= success, `FAILED` = destructive), Organization, Requested/Completed
timestamps, and an action cell that shows Download (if `SUCCESS`), the error
message (if `FAILED`), or "Pending" text otherwise.

**Edge cases / notes:** Reports are generated **asynchronously** - a
`POST` only creates a `PENDING` request record; there is no polling/interval
in this page to auto-refresh status, so the admin must manually reload to see
a request move to `PROCESSING`/`SUCCESS`/`FAILED`. Download is blocked
entirely until status is `SUCCESS`. Metadata responses never include the raw
file bytes - those are only fetched via the dedicated download endpoint.

---

## /admin/executive-dashboard

**Purpose:** High-level, single-screen BI dashboard for platform leadership -
revenue, growth, org/app counts, financial health, ERP adoption, infra health,
and revenue leaderboards, all for a selectable time period.

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/analytics/executive-dashboard?period=<DAILY|WEEKLY|MONTHLY>` -
  the single data source for the whole page; refetched whenever `period`
  changes.

**Key UI/behavior:** Stat tiles for platform revenue (minor units), MRR, ARR,
growth rate (%), active/total organizations, new organizations, active/total
applications, new applications, refund rate (%), chargeback rate (%),
financial sync success rate (%), and API usage count. Additional cards: ERP
adoption (badge + "X of Y organizations connected"), Infrastructure health
(database up/down badge, app version, sync queue pending count, webhook
delivery pending count), and three leaderboards - Top Applications, Top
Developers, Top Customers, each by revenue (minor units) for the selected
period.

**Edge cases / notes:** All values come from one aggregate endpoint - no
per-tile fetch. Empty leaderboards render "No revenue in this period." instead
of an empty list. No auto-refresh/polling; changing the period dropdown is the
only way to refetch.

---

## /admin/platform-intelligence

**Purpose:** Broader "advanced analytics" surface - every individual analytics
metric as its own tile, plus a platform-wide entity search. A superset/detail
view alongside the more curated Executive Dashboard.

**Access requirements:** platform-admin only (see intro).

**API calls:**

- `GET /admin/analytics/platform?metric=<METRIC>&scope=PLATFORM&period=<period>` -
  one independent call per metric tile (18 metrics: `MRR`, `ARR`,
  `CHURN_RATE`, `TRIAL_CONVERSION_RATE`, `REVENUE`, `REFUND_RATE`,
  `CHARGEBACK_RATE`, `CUSTOMER_LIFETIME_VALUE`, `RETENTION_RATE`,
  `GROWTH_RATE`, `DAILY_ACTIVE_USERS`, `MONTHLY_ACTIVE_USERS`,
  `SEAT_UTILIZATION`, `LICENSE_USAGE`, `API_USAGE`, `WEBHOOK_VOLUME`,
  `STORAGE_USAGE`, `FINANCIAL_SYNC_SUCCESS_RATE`), refetched per metric when
  `period` changes.
- `GET /admin/search?q=<query>&types=<comma-separated types>` - triggered by
  submitting the Global Search form.

**Key UI/behavior:** Grid of metric tiles (value + optional per-currency
breakdown badges for monetary metrics). Period selector (`DAILY`, `WEEKLY`,
`MONTHLY`) applies to all tiles. Global Search section: free-text query plus
checkboxes to include/exclude each of 8 result types (`organizations`,
`applications`, `customers`, `subscriptions`, `invoices`, `licenses`,
`apiKeys`, `reviews`); results render grouped by type, each row showing a
label and a truncated (8-char) ID. A "Request a report" link goes to
`/admin/report-requests`.

**Edge cases / notes:** Each metric tile fails independently (`error` shown
inline in that tile only, not a page-wide alert) so one bad metric doesn't
block the rest. Search does nothing if the query is blank (`if (!q.trim())
return;`). Search result groups with zero rows are filtered out of the
display; if every group is empty, a single "No results." message is shown
instead.
