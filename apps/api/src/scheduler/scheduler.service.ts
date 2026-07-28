import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  DeviceStatus,
  JobStatus,
  LicenseStatus,
  PaymentTransactionStatus,
  TrialStatus,
  type BackgroundJob,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BackgroundJobsService } from "../background-jobs/background-jobs.service";
import { JobProcessorRegistryService } from "../background-jobs/job-processor-registry.service";
import { computeNextRun } from "../background-jobs/schedule.util";

const QUEUE_NAME = "scheduled";

const DEVICE_INACTIVITY_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const RENEWAL_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** Job `type` strings this module registers processors for - also the recurring `BackgroundJob.type` used to enqueue each. */
export const SCHEDULED_TASK_TYPES = {
  TRIAL_EXPIRATION: "SCHEDULED:trial-expiration",
  RENEWAL_REMINDERS: "SCHEDULED:renewal-reminders",
  LICENSE_CLEANUP: "SCHEDULED:license-cleanup",
  DEVICE_CLEANUP: "SCHEDULED:device-cleanup",
  ERP_RETRY: "SCHEDULED:erp-retry",
  WEBHOOK_RETRY: "SCHEDULED:webhook-retry",
  LOG_CLEANUP: "SCHEDULED:log-cleanup",
  DB_MAINTENANCE: "SCHEDULED:db-maintenance",
  DAILY_STATS: "SCHEDULED:daily-stats",
  MONTHLY_STATS: "SCHEDULED:monthly-stats",
} as const;

interface ScheduledTaskDefinition {
  type: string;
  cron: string;
  processor: (payload: Prisma.JsonValue, job: BackgroundJob) => Promise<void>;
}

/**
 * Phase 10 Scheduler: registers one processor per recurring platform-
 * maintenance task with the generic `JobProcessorRegistryService`, and
 * enqueues the first occurrence of each as a recurring `BackgroundJob`
 * (the already-built `JobWorkerService` re-enqueues every subsequent
 * occurrence on success via `BackgroundJob.cron` - see `schedule.util.ts`).
 *
 * This module owns no state of its own and drives no polling loop -
 * it is purely "what runs, on what schedule, doing what", layered on
 * top of the generic Background Job framework built earlier in this
 * phase (`apps/api/src/background-jobs/`).
 *
 * Several tasks here deliberately do NOT mutate rows owned by another
 * module's established lifecycle machinery (Subscriptions, ERP sync,
 * webhook dispatch) to avoid redesigning or duplicating those modules'
 * own dedicated sweeps - see the per-task comments below for exactly
 * which tasks are real mutations vs. documented log-only stubs.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly registry: JobProcessorRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const definitions = this.buildTaskDefinitions();

    // Register every processor first (registry.register throws on a
    // duplicate type, so this must run exactly once regardless of how
    // many times the module gets instantiated).
    for (const definition of definitions) {
      this.registry.register(definition.type, definition.processor);
    }

    // Then enqueue the first occurrence of each recurring job, but only
    // if one isn't already pending/scheduled - otherwise every app
    // restart would spawn a duplicate recurring chain for each task.
    for (const definition of definitions) {
      await this.enqueueIfMissing(definition.type, definition.cron);
    }
  }

  private async enqueueIfMissing(type: string, cron: string): Promise<void> {
    const existing = await this.prisma.backgroundJob.findFirst({
      where: { type, status: { in: [JobStatus.PENDING, JobStatus.SCHEDULED] } },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const runAt = computeNextRun(cron, new Date());
    await this.backgroundJobsService.enqueue(type, {}, { queueName: QUEUE_NAME, cron, runAt });
    this.logger.log(
      `Enqueued first occurrence of "${type}" for ${runAt.toISOString()} (cron: ${cron})`,
    );
  }

  private buildTaskDefinitions(): ScheduledTaskDefinition[] {
    return [
      {
        type: SCHEDULED_TASK_TYPES.TRIAL_EXPIRATION,
        cron: "every:1h",
        processor: () => this.runTrialExpiration(),
      },
      {
        type: SCHEDULED_TASK_TYPES.RENEWAL_REMINDERS,
        cron: "daily:09:00",
        processor: () => this.runRenewalReminders(),
      },
      {
        type: SCHEDULED_TASK_TYPES.LICENSE_CLEANUP,
        cron: "daily:02:00",
        processor: () => this.runLicenseCleanup(),
      },
      {
        type: SCHEDULED_TASK_TYPES.DEVICE_CLEANUP,
        cron: "daily:03:00",
        processor: () => this.runDeviceCleanup(),
      },
      {
        type: SCHEDULED_TASK_TYPES.ERP_RETRY,
        cron: "every:1h",
        processor: () => this.runErpRetry(),
      },
      {
        type: SCHEDULED_TASK_TYPES.WEBHOOK_RETRY,
        cron: "every:1h",
        processor: () => this.runWebhookRetry(),
      },
      {
        type: SCHEDULED_TASK_TYPES.LOG_CLEANUP,
        cron: "daily:04:00",
        processor: () => this.runLogCleanup(),
      },
      {
        type: SCHEDULED_TASK_TYPES.DB_MAINTENANCE,
        cron: "weekly:0:05:00",
        processor: () => this.runDbMaintenance(),
      },
      {
        type: SCHEDULED_TASK_TYPES.DAILY_STATS,
        cron: "daily:01:00",
        processor: () => this.runDailyStats(),
      },
      {
        type: SCHEDULED_TASK_TYPES.MONTHLY_STATS,
        cron: "monthly:1:01:00",
        processor: () => this.runMonthlyStats(),
      },
    ];
  }

  // ---------------------------------------------------------------------
  // 1. Trial expiration (REAL for standalone trials, log-only otherwise)
  // ---------------------------------------------------------------------
  /**
   * Finds `Trial` rows that are still ACTIVE past their `endsAt`.
   *
   * - If the trial is not yet linked to a `Subscription` (`subscriptionId`
   *   is null - a trial that hasn't converted), this task owns that row
   *   outright and marks it EXPIRED directly; nothing else in the
   *   codebase manages a standalone Trial's own status.
   * - If the trial IS linked to a Subscription, `SubscriptionsService`
   *   owns that lifecycle transition (`expire()` flips the Subscription
   *   to EXPIRED and the linked Trial to EXPIRED together, records a
   *   `SubscriptionEvent`, etc.) and requires an acting `userId` plus
   *   its own transactional invariants. Importing `SubscriptionsModule`
   *   here to call it as a "system" actor is exactly the kind of
   *   redesign-another-module's-machinery this phase is meant to avoid,
   *   so this task deliberately only LOGS which subscription-linked
   *   trials are overdue and leaves the actual transition to whatever
   *   mechanism already flips those subscriptions (renewal processing,
   *   an admin action, or a future dedicated hook into `expire()`).
   */
  private async runTrialExpiration(): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.trial.findMany({
      where: { status: TrialStatus.ACTIVE, endsAt: { lt: now } },
      select: { id: true, subscriptionId: true, customerId: true, endsAt: true },
      take: 200,
    });

    if (overdue.length === 0) {
      this.logger.log("Trial expiration sweep: no overdue trials found");
      return;
    }

    const standalone = overdue.filter((t) => !t.subscriptionId);
    const subscriptionLinked = overdue.filter((t) => t.subscriptionId);

    if (standalone.length > 0) {
      const result = await this.prisma.trial.updateMany({
        where: { id: { in: standalone.map((t) => t.id) }, status: TrialStatus.ACTIVE },
        data: { status: TrialStatus.EXPIRED },
      });
      this.logger.log(
        `Trial expiration sweep: marked ${result.count} standalone (non-subscription-linked) trial(s) EXPIRED`,
      );
    }

    if (subscriptionLinked.length > 0) {
      this.logger.warn(
        `Trial expiration sweep: ${subscriptionLinked.length} subscription-linked trial(s) are overdue ` +
          `but left untouched (owned by SubscriptionsService.expire()): ${subscriptionLinked
            .map((t) => `trial=${t.id} subscription=${t.subscriptionId}`)
            .join(", ")}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // 2. Subscription renewal reminders (REAL query + log; notification
  //    delivery is a documented hook point, not yet wired)
  // ---------------------------------------------------------------------
  /**
   * `apps/api/src/notifications-engine/` currently only contains DTOs -
   * there is no `PlatformNotificationsService` (or equivalent) to inject
   * yet. This task does the real work of finding subscriptions renewing
   * in the next 3 days and logs one structured line per subscription so
   * the hook point is obvious; once a notification-sending service
   * exists, replace the `logger.log` call below with a call to it.
   */
  private async runRenewalReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RENEWAL_REMINDER_WINDOW_MS);

    const upcoming = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { gte: now, lte: windowEnd },
      },
      select: { id: true, customerId: true, organizationId: true, currentPeriodEnd: true },
      take: 500,
    });

    this.logger.log(
      `Renewal reminder sweep: ${upcoming.length} subscription(s) renewing within 3 days`,
    );
    for (const sub of upcoming) {
      // NOTIFICATION HOOK POINT: once notifications-engine exposes a
      // sendable service, replace this log line with e.g.
      //   await this.platformNotifications.send({
      //     category: "SUBSCRIPTION_EXPIRING",
      //     customerId: sub.customerId,
      //     payload: { subscriptionId: sub.id, currentPeriodEnd: sub.currentPeriodEnd },
      //   });
      this.logger.log(
        `Renewal reminder: subscription=${sub.id} customer=${sub.customerId} ` +
          `organization=${sub.organizationId} renews=${sub.currentPeriodEnd?.toISOString()}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // 3. Expired license cleanup (REAL)
  // ---------------------------------------------------------------------
  private async runLicenseCleanup(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.license.findMany({
      where: { status: LicenseStatus.ACTIVE, expiresAt: { lt: now } },
      select: { id: true, organizationId: true },
      take: 200,
    });

    if (expired.length === 0) {
      this.logger.log("License cleanup sweep: no expired licenses found");
      return;
    }

    const result = await this.prisma.license.updateMany({
      where: { id: { in: expired.map((l) => l.id) }, status: LicenseStatus.ACTIVE },
      data: { status: LicenseStatus.EXPIRED },
    });

    this.logger.log(`License cleanup sweep: marked ${result.count} license(s) EXPIRED`);

    await this.auditService.record({
      action: "LICENSE_ADMIN_ACTION",
      metadata: {
        source: "SCHEDULED:license-cleanup",
        count: result.count,
        licenseIds: expired.map((l) => l.id),
      },
    });
  }

  // ---------------------------------------------------------------------
  // 4. Inactive device cleanup (REAL)
  // ---------------------------------------------------------------------
  private async runDeviceCleanup(): Promise<void> {
    const threshold = new Date(Date.now() - DEVICE_INACTIVITY_THRESHOLD_MS);
    const inactive = await this.prisma.deviceRegistration.findMany({
      where: { status: DeviceStatus.ACTIVE, lastSeenAt: { lt: threshold } },
      select: { id: true, applicationId: true, organizationId: true },
      take: 200,
    });

    if (inactive.length === 0) {
      this.logger.log("Device cleanup sweep: no inactive devices found");
      return;
    }

    const result = await this.prisma.deviceRegistration.updateMany({
      where: { id: { in: inactive.map((d) => d.id) }, status: DeviceStatus.ACTIVE },
      data: { status: DeviceStatus.INACTIVE },
    });

    this.logger.log(
      `Device cleanup sweep: marked ${result.count} device(s) INACTIVE (no activity in 90+ days)`,
    );

    await this.auditService.record({
      action: "DEVICE_DEACTIVATED",
      metadata: {
        source: "SCHEDULED:device-cleanup",
        count: result.count,
        deviceIds: inactive.map((d) => d.id),
        inactivityThresholdDays: 90,
      },
    });
  }

  // ---------------------------------------------------------------------
  // 5. Pending ERP retry (LOG-ONLY STUB - already handled)
  // ---------------------------------------------------------------------
  /**
   * `SyncEngineService` (`apps/api/src/financial-events/sync-engine.service.ts`)
   * already runs its own `OnModuleInit` sweep every 30s over due/retrying
   * `FinancialSync` rows - it is a fully self-contained retry engine.
   * Calling `syncEngineService.processDue()` again from here would be a
   * second, redundant trigger racing the same rows; nothing in this task
   * would make retries happen any sooner or more reliably. This task is
   * therefore an intentional no-op that only logs, to avoid building a
   * second ERP-retry mechanism as the task brief warns against.
   */
  private async runErpRetry(): Promise<void> {
    this.logger.log(
      "ERP retry sweep: no-op - pending FinancialSync retries are already handled by " +
        "SyncEngineService's own 30s sweep (apps/api/src/financial-events/sync-engine.service.ts)",
    );
  }

  // ---------------------------------------------------------------------
  // 6. Webhook retry (LOG-ONLY STUB - already handled)
  // ---------------------------------------------------------------------
  /**
   * Same reasoning as `runErpRetry` above: `WebhookDispatchService`
   * (`apps/api/src/webhooks/webhook-dispatch.service.ts`) already runs its
   * own `OnModuleInit` sweep every 30s over pending `WebhookDelivery`
   * rows. This task is an intentional no-op.
   */
  private async runWebhookRetry(): Promise<void> {
    this.logger.log(
      "Webhook retry sweep: no-op - pending WebhookDelivery retries are already handled by " +
        "WebhookDispatchService's own 30s sweep (apps/api/src/webhooks/webhook-dispatch.service.ts)",
    );
  }

  // ---------------------------------------------------------------------
  // 7. Old log cleanup (REAL, but conservative - only JobHistoryEntry)
  // ---------------------------------------------------------------------
  /**
   * `AuditLog` and `PlatformEvent` are compliance/audit-relevant records
   * and are deliberately left alone here - this task never deletes them,
   * only counts+logs how many are older than the retention window so an
   * operator can decide on an archival policy later. The one category
   * this task DOES delete is `JobHistoryEntry` rows tied to a `SUCCESS`
   * job older than 90 days - purely an operational attempt-log for the
   * Background Job framework, not an audit trail, so pruning it is safe.
   */
  private async runLogCleanup(): Promise<void> {
    const threshold = new Date(Date.now() - LOG_RETENTION_MS);

    const [oldAuditLogCount, oldPlatformEventCount, deletedHistory] = await Promise.all([
      this.prisma.auditLog.count({ where: { createdAt: { lt: threshold } } }),
      this.prisma.platformEvent.count({ where: { createdAt: { lt: threshold } } }),
      this.prisma.jobHistoryEntry.deleteMany({
        where: {
          status: JobStatus.SUCCESS,
          backgroundJob: { completedAt: { lt: threshold } },
        },
      }),
    ]);

    this.logger.log(
      `Log cleanup sweep: deleted ${deletedHistory.count} SUCCESS JobHistoryEntry row(s) older than 90 days. ` +
        `AuditLog rows older than 90 days: ${oldAuditLogCount} (left untouched, compliance-relevant). ` +
        `PlatformEvent rows older than 90 days: ${oldPlatformEventCount} (left untouched, compliance-relevant).`,
    );
  }

  // ---------------------------------------------------------------------
  // 8. Database maintenance (LIGHT-TOUCH PLACEHOLDER)
  // ---------------------------------------------------------------------
  /**
   * Postgres autovacuum already handles routine VACUUM/ANALYZE; running
   * our own ANALYZE/VACUUM here would just race autovacuum without a
   * concrete problem to solve. This task is a lightweight heartbeat -
   * a trivial read-only round-trip to confirm the database connection
   * is healthy - documented as a placeholder for a real maintenance
   * routine (e.g. targeted `ANALYZE` on a specific hot table) if one is
   * ever identified as necessary.
   */
  private async runDbMaintenance(): Promise<void> {
    const startedAt = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    this.logger.log(
      `Database maintenance heartbeat: connection healthy (${Date.now() - startedAt}ms)`,
    );
  }

  // ---------------------------------------------------------------------
  // 9. Daily / monthly statistics (REAL)
  // ---------------------------------------------------------------------
  private async runDailyStats(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await this.computeAndLogStats("daily", periodStart, now);
  }

  private async runMonthlyStats(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()),
    );
    await this.computeAndLogStats("monthly", periodStart, now);
  }

  private async computeAndLogStats(
    period: "daily" | "monthly",
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const createdWindow = { gte: periodStart, lte: periodEnd };

    const [newUsers, newOrganizations, newSubscriptions, paymentsSucceeded, paymentsFailed] =
      await Promise.all([
        this.prisma.user.count({ where: { createdAt: createdWindow } }),
        this.prisma.organization.count({ where: { createdAt: createdWindow } }),
        this.prisma.subscription.count({ where: { createdAt: createdWindow } }),
        this.prisma.paymentTransaction.count({
          where: { createdAt: createdWindow, status: PaymentTransactionStatus.SUCCEEDED },
        }),
        this.prisma.paymentTransaction.count({
          where: { createdAt: createdWindow, status: PaymentTransactionStatus.FAILED },
        }),
      ]);

    this.logger.log(
      `${period === "daily" ? "Daily" : "Monthly"} stats [${periodStart.toISOString()} .. ${periodEnd.toISOString()}]: ` +
        `newUsers=${newUsers} newOrganizations=${newOrganizations} newSubscriptions=${newSubscriptions} ` +
        `paymentsSucceeded=${paymentsSucceeded} paymentsFailed=${paymentsFailed}`,
    );
  }
}
