# Platform Admin — Platform Operations

This entire section lives under `/admin/*` and is internal-only: it is gated client-side by
`apps/web/src/app/admin/layout.tsx` (see that file for the exact admin-check logic), and every
`/admin/*` API route independently 403s for non-admins on the server. The pages below cover the
event bus, automation rules, background job workers/queues, scheduled jobs, notifications, system
health, audit logs, fraud detection, and review moderation — i.e. the operational control plane
for the platform, not tenant-facing features. Several actions on these pages directly affect live
infrastructure (pausing queues, disabling automation, retrying/cancelling jobs) and are flagged
accordingly.

---

## /admin/events

**Purpose:** Browse the platform event log — the audit trail of domain events (subscriptions,
payments, licenses, webhooks, ERP sync, etc.) that drive background jobs and automation rules.

**Access requirements:** platform-admin only (via layout gate).

**API calls:**

- `GET /admin/events` (+ query params) — initial load and on filter submit.
- `GET /admin/events?cursor=...` (same filters) — "Load more" (cursor pagination).

**Key UI/behavior:**

- Filters: event type (from a fixed `PLATFORM_EVENT_TYPES` list), status (`PENDING` /
  `DISPATCHED` / `FAILED`), organization ID, application ID, customer ID, correlation ID.
- Read-only list; each row links to the event detail page.

**Edge cases / notes:** Purely read-only — no mutating actions on this page.

---

## /admin/events/[eventId]

**Purpose:** Full detail view of a single platform event: payload, and everything it triggered
downstream (background jobs and automation rule executions).

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/events/{eventId}` — loads event detail on mount.

**Key UI/behavior:**

- Shows raw JSON payload.
- "Background jobs" table: jobs spawned by this event, with links to `/admin/workers/{jobId}`.
- "Automation rule runs" table: automation rule executions triggered by this event (rule name,
  status, actions run count, error).

**Edge cases / notes:** Read-only detail page; no actions performed here — it's a cross-reference
hub linking out to jobs and rules.

---

## /admin/automation-rules

**Purpose:** Define and manage rules that automatically fire background actions when a given
platform event type occurs (e.g. send a notification when `SUBSCRIPTION_RENEWED` fires).

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/automation-rules` — load all rules.
- `POST /admin/automation-rules` — create a rule (name, optional description, trigger event type,
  actions array).
- `POST /admin/automation-rules/{ruleId}/toggle` — **enable/disable a rule** (body: `{ enabled }`).
- `GET /admin/automation-rules/{ruleId}/executions` — lazy-loaded on "Details" expand, per rule.

**Key UI/behavior:**

- Create form: trigger event type is a dropdown of `PLATFORM_EVENT_TYPES`; actions is a free-form
  JSON array textarea (e.g. `[{ "action": "SEND_NOTIFICATION", "category": "SUBSCRIPTION_RENEWED" }]`)
  parsed and validated client-side before submit.
- **Enable/Disable toggle is operationally significant** — disabling a rule silently stops all
  automated actions tied to that event type going forward (no explicit warning/confirmation in the
  UI beyond the button label change).
- "Details" expands inline to show the rule's description, raw actions JSON, and recent executions
  (event ID, status, actions run, error, started time).

**Edge cases / notes:** Actions have no fixed schema — they're stored/rendered as opaque
`Record<string, unknown>[]`; the API defines what action keys are actually recognized. Execution
status is one of `SUCCEEDED` / `FAILED` / `PARTIAL` (partial = some actions in the array succeeded,
others failed).

---

## /admin/workers

**Purpose:** List view of all background jobs across every queue (the job processing system that
executes work such as notification sends, webhook deliveries, financial syncs, etc.).

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/jobs` (+ query params `queueName`, `status`, `type`) — load/filter jobs.

**Key UI/behavior:**

- Filters: queue name (free text), status (`PENDING`, `SCHEDULED`, `PROCESSING`, `SUCCESS`,
  `RETRYING`, `FAILED`, `DEAD_LETTER`, `CANCELLED`), job type (free text).
- Table shows type, queue, priority (`LOW`/`NORMAL`/`HIGH`/`CRITICAL`), status badge, attempt
  count/max attempts, cron spec (if recurring), last updated. Each row links to job detail.

**Edge cases / notes:** This is a read-only list — actions (retry/cancel) live on the job detail
page, not here.

---

## /admin/workers/[jobId]

**Purpose:** Detail view of a single background job, including its payload, full attempt history,
and manual retry/cancel controls.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/jobs/{jobId}` — load job detail.
- `POST /admin/jobs/{jobId}/retry` — **Retry button.**
- `POST /admin/jobs/{jobId}/cancel` — **Cancel button.**

**Key UI/behavior:**

- Overview: queue, priority, attempts/max, cron, `runAt`, `nextAttemptAt`, correlation ID, source
  event (linked to `/admin/events/{id}`), completed/cancelled timestamps, last error.
- **Retry and Cancel are operationally significant** — Retry re-queues a job (which may include
  jobs already in `DEAD_LETTER` or `FAILED`), Cancel stops it from running. Both are simple POST
  buttons with no confirmation dialog beyond disabling the button while busy.
- History table: one row per attempt with status, duration (ms), error, timestamp.

**Edge cases / notes:** `DEAD_LETTER` status means the job exhausted `maxAttempts` retries and was
moved out of active processing — it requires a manual Retry to run again. Payload is rendered as
raw JSON.

---

## /admin/job-queues

**Purpose:** Operational control panel for job queues themselves — per-queue running/paused state
and per-status job counts, with pause/resume controls. (Titled "Queues" in the page header.)

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/jobs/queues` — load queue summaries.
- `POST /admin/jobs/queues/{queueName}/pause` — **Pause a queue.**
- `POST /admin/jobs/queues/{queueName}/resume` — **Resume a queue.**

**Key UI/behavior:**

- One row per queue: name, Running/Paused badge, a count column per `JOB_STATUSES` value, and a
  Pause/Resume button.
- **Pausing a queue is operationally significant and stops all job processing on that queue
  platform-wide** until resumed — this directly disrupts production processing (e.g. pausing the
  notifications queue stops all outgoing notifications). No confirmation dialog is shown.

**Edge cases / notes:** This page is distinct from `/admin/queues` below despite the similar name —
this one manages queue state (pause/resume) via `/admin/jobs/queues*`; `/admin/queues` is a
read-only live monitoring dashboard hitting a completely different endpoint
(`/admin/monitoring/overview`). Do not confuse the two when linking or training users.

---

## /admin/queues

**Purpose:** Live "System Monitoring" dashboard — a grid of health/volume panels covering API
requests, webhook deliveries, ERP syncs, payment processing, queue length, worker status, database
status, cache status, storage usage, and background jobs. (Page header reads "System Monitoring",
despite the route being named `/admin/queues`.)

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/monitoring/overview` — single call loads all panels; no polling/auto-refresh
  (reloads only on mount).

**Key UI/behavior:**

- Renders each panel key generically: if the value is present it's shown as JSON/text, otherwise
  "Not available" (optionally with a `reason` string if the payload includes one).
- Entirely read-only — no actions, filters, or mutation on this page.

**Edge cases / notes:** Despite living at the `/admin/queues` route, this is not a queue management
page — see `/admin/job-queues` above for the actual pause/resume/queue-state feature. Any given
panel key may be entirely absent from the API response (rendered as "Not available"); this is
tolerated by the UI rather than treated as an error.

---

## /admin/scheduled-jobs

**Purpose:** Read-only view of recurring jobs — background jobs that have a cron schedule attached.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/jobs` — loads all jobs, then filters client-side to `job.cron !== null`. There is no
  dedicated scheduled-jobs endpoint; this page is a derived view over the same jobs list used by
  `/admin/workers`.

**Key UI/behavior:**

- Table: type, cron expression, status badge, next run (prefers `nextAttemptAt`, falls back to
  `runAt`), and a "View" link to the job detail page (`/admin/workers/{jobId}`) where retry/cancel
  actions actually live.

**Edge cases / notes:** No filtering/search UI and no actions on this page itself — all mutation
happens via the linked job detail page.

---

## /admin/notifications

**Purpose:** View sent platform notifications and their per-channel delivery status; also allows
sending an ad-hoc/test notification.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/notifications` — load notification list.
- `POST /admin/notifications` — **send a notification** (category, optional recipient user/org/
  customer ID, payload JSON, optional channel override list, optional correlation ID).
- `GET /admin/notifications/{id}` — lazy-loaded on "Deliveries" expand, to fetch per-channel
  delivery detail.

**Key UI/behavior:**

- "Send test notification" form: category is a fixed dropdown (`NOTIFICATION_CATEGORIES`),
  channels are optional checkboxes (if none selected, the template's default channel is used).
  Payload is free-form JSON validated client-side.
- **Sending a notification here dispatches a real notification** through the platform's channels —
  this is not a sandboxed test despite the form label ("Send test notification"); it will actually
  deliver to whatever recipient/org/customer ID is entered.
- "Deliveries" expands per-row to show channel, delivery status, attempt count, error, sent time.

**Edge cases / notes:** None beyond the above — the "test" framing in the UI copy doesn't reflect
an actual dry-run mode in the API calls used.

---

## /admin/notification-templates

**Purpose:** CRUD-style management of the templates used to render outgoing notifications
(subject + body with `{{variable}}` placeholders), scoped by category and channel.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/notification-templates` (+ `category`, `channel` filters) — load/filter templates.
- `POST /admin/notification-templates` — create a template (key, category, channel, optional
  subject, body template, active flag).
- `PATCH /admin/notification-templates/{id}` — edit a template (subject, body, active flag).

**Key UI/behavior:**

- Inline "Edit" expands a row into an editable subject/body/active form with a Save button (no
  create-a-new-version — it's a direct in-place PATCH).
- **Setting `isActive` to false, or editing `bodyTemplate`, is operationally significant** — it
  changes what real notifications look like or whether that template can be used at all, and takes
  effect immediately platform-wide (no draft/publish step or confirmation).

**Edge cases / notes:** Body template placeholder substitution (`{{variable}}`) happens server-side
at send time — this page just edits the raw template string with no client-side preview/validation
of variable names.

---

## /admin/system-health

**Purpose:** Live health-check dashboard for platform-dependent providers/services (e.g. payment
processor, database, etc. — exact provider list comes from the API).

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/system-health` — loads on mount, then **polls every 20 seconds**
  (`POLL_INTERVAL_MS = 20_000`) for the lifetime of the page.

**Key UI/behavior:**

- Overall banner: `HEALTHY` / `DEGRADED` / `DOWN`, color-coded.
- Per-provider cards: status badge, message, last-checked time, and an optional "Show details"
  toggle revealing a raw JSON details blob.

**Edge cases / notes:** Entirely read-only monitoring; the 20s polling interval is the only
"refresh" behavior — there's no manual refresh button. Only the initial load shows a full-page
loading state; subsequent polls update silently without a loading flicker.

---

## /admin/audit-center

**Purpose:** Platform-wide audit trail of admin and user actions, with filtering and CSV export.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/audit-log` (+ query params) — initial load and on "Apply filters".
- `GET /admin/audit-log?cursor=...` (same filters) — "Load more" (cursor pagination).
- `GET /admin/audit-log/export` (+ same filters, via raw `fetch`, not `authedFetch`) — **"Export to
  CSV" button**; streams a blob and triggers a browser download of `audit-log.csv`.

**Key UI/behavior:**

- Filters: organization ID, application ID, user ID, action (free text), date range (`from`/`to`).
- Table: action, actor (email or user ID), target (`type:id` or fallback to org/app/user ID),
  timestamp.

**Edge cases / notes:** The export call bypasses the shared `authedFetch` helper and manually
attaches the bearer token plus `credentials: "include"`, because it needs to consume a raw
`Blob` response rather than JSON — worth knowing if debugging auth issues specific to export but
not to the rest of the page.

---

## /admin/fraud-center

**Purpose:** Platform-wide fraud/abuse signal dashboard, broken into sections by signal type:
failed payments, suspicious logins, device abuse, API abuse, webhook abuse, excessive trials, and
chargebacks.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/fraud/{type}` — one independent call per signal type (`failed-payments`,
  `suspicious-logins`, `device-abuse`, `api-abuse`, `webhook-abuse`, `excessive-trials`,
  `chargebacks`), each rendered as its own card/section on mount.

**Key UI/behavior:**

- Each section renders generically: organization, user, up to 3 extra fields discovered
  dynamically from the first item's keys (excluding `id`/`organizationId`/`userId`/
  `applicationId`/`createdAt`), and created time.
- Entirely read-only — no resolve/dismiss/acknowledge actions on this page (unlike Review Reports
  below).

**Edge cases / notes:** Signal records have no fixed schema beyond a few common fields
(`AdminFraudSignal` allows arbitrary extra keys) — the UI infers which extra columns to show per
signal type from whatever the first row happens to contain, so different signal types display
different columns, and a section with zero items falls back to just the common columns implicitly
(not applicable since no extra keys are shown without an item).

---

## /admin/review-reports

**Purpose:** Moderation queue for reviews flagged by customers as inappropriate/abusive.

**Access requirements:** platform-admin only.

**API calls:**

- `GET /admin/review-reports` (+ `status` filter, defaults to `PENDING` on load) — load reports.
- `PATCH /admin/review-reports/{id}` — **resolve a report** (body: `{ status }`, either
  `REVIEWED` or `DISMISSED`).

**Key UI/behavior:**

- Status filter dropdown (`PENDING`/other `REVIEW_REPORT_STATUSES` values/All).
- Each pending row shows application name, review content (rating, title, body — with a "Deleted"
  badge if the underlying review was soft-deleted), report reason, status, reported date.
- **"Mark reviewed" and "Dismiss" buttons resolve the report** (moderation decision) — this does
  not appear to delete or hide the underlying review itself, only changes the report's status.
  Resolved reports show a "Resolved {date}" label instead of action buttons.

**Edge cases / notes:** A report can point at a review that's already been soft-deleted
(`report.review.deletedAt` set) — the UI still shows the report with a "Deleted" badge rather than
hiding it, since moderating the _report_ is independent of the review's own lifecycle.
