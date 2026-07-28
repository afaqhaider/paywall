import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  AutomationRunStatus,
  type NotificationCategory,
  type NotificationChannel,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobProcessorRegistryService } from "../background-jobs/job-processor-registry.service";
import { AuditService } from "../audit/audit.service";
import { PlatformNotificationsService } from "../notifications-engine/platform-notifications.service";

export const AUTOMATION_RULE_EXECUTION_JOB_TYPE = "AUTOMATION_RULE_EXECUTION";

interface ActionDescriptor {
  action: string;
  [key: string]: unknown;
}

/**
 * Interprets `AutomationRule.actions` against the `PlatformEvent` that
 * triggered a rule. Runs as the `AUTOMATION_RULE_EXECUTION` background job
 * processor (enqueued by `PlatformEventsService.publish()` - see that file
 * for how rules get matched to events). A fixed, small action vocabulary:
 *
 * - SEND_NOTIFICATION: fans out through `PlatformNotificationsService.send()`
 *   (the single notification entry point - never sends directly).
 * - LOG_AUDIT: writes an `AuditLog` row via the existing `AuditService`.
 * - RECORD_FINANCIAL_EVENT / SYNC_ERP: documented no-ops. Phase 8's
 *   `FinancialEventsService`/`SyncEngineService` already record financial
 *   events and drive ERP sync directly and correctly for every real
 *   payment/subscription action; running them again here from a generic
 *   automation action would double-book financial data. Kept as named,
 *   logged steps so a rule author can still see the step ran, without
 *   duplicating another module's owned logic.
 * - REFRESH_ENTITLEMENTS: documented no-op. Entitlements are resolved live
 *   on every read (`EntitlementResolverService`) with no cache to
 *   invalidate, so there is nothing to "refresh".
 */
@Injectable()
export class AutomationActionExecutorService implements OnModuleInit {
  private readonly logger = new Logger(AutomationActionExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: JobProcessorRegistryService,
    private readonly auditService: AuditService,
    private readonly platformNotifications: PlatformNotificationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(AUTOMATION_RULE_EXECUTION_JOB_TYPE, (payload) => this.execute(payload));
  }

  private async execute(payload: Prisma.JsonValue): Promise<void> {
    const { ruleId, eventId } = payload as { ruleId: string; eventId: string };

    const [rule, event] = await Promise.all([
      this.prisma.automationRule.findUniqueOrThrow({ where: { id: ruleId } }),
      this.prisma.platformEvent.findUniqueOrThrow({ where: { id: eventId } }),
    ]);

    if (!rule.enabled) {
      this.logger.log(`Skipping execution of disabled rule ${rule.id} for event ${event.id}`);
      return;
    }

    const actions = (rule.actions as unknown as ActionDescriptor[]) ?? [];
    let actionsRun = 0;
    let firstError: string | undefined;

    for (const descriptor of actions) {
      try {
        await this.runAction(descriptor, event);
        actionsRun += 1;
      } catch (error) {
        firstError = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Automation rule ${rule.id} action "${descriptor.action}" failed for event ${event.id}: ${firstError}`,
        );
        break;
      }
    }

    const status =
      actionsRun === actions.length
        ? AutomationRunStatus.SUCCEEDED
        : actionsRun > 0
          ? AutomationRunStatus.PARTIAL
          : AutomationRunStatus.FAILED;

    await this.prisma.automationRuleExecution.create({
      data: {
        ruleId: rule.id,
        eventId: event.id,
        status,
        actionsRun,
        error: firstError,
        completedAt: new Date(),
      },
    });

    if (firstError) {
      throw new Error(firstError);
    }
  }

  private async runAction(
    descriptor: ActionDescriptor,
    event: {
      id: string;
      type: string;
      organizationId: string | null;
      applicationId: string | null;
      customerId: string | null;
      payload: Prisma.JsonValue;
    },
  ): Promise<void> {
    switch (descriptor.action) {
      case "SEND_NOTIFICATION": {
        await this.platformNotifications.send({
          category: descriptor.category as NotificationCategory,
          organizationId: event.organizationId ?? undefined,
          customerId: event.customerId ?? undefined,
          recipientUserId: descriptor.recipientUserId as string | undefined,
          channels: descriptor.channels as NotificationChannel[] | undefined,
          payload: { ...(event.payload as Record<string, unknown>), eventType: event.type },
          correlationId: event.id,
        });
        return;
      }
      case "LOG_AUDIT": {
        await this.auditService.record({
          action: "AUTOMATION_ACTION_LOGGED",
          organizationId: event.organizationId ?? undefined,
          applicationId: event.applicationId ?? undefined,
          metadata: { source: "automation-rule", eventId: event.id, eventType: event.type },
        });
        return;
      }
      case "RECORD_FINANCIAL_EVENT":
        this.logger.log(
          `[no-op] RECORD_FINANCIAL_EVENT for event ${event.id} - already handled directly by FinancialEventsService`,
        );
        return;
      case "SYNC_ERP":
        this.logger.log(
          `[no-op] SYNC_ERP for event ${event.id} - already handled directly by SyncEngineService`,
        );
        return;
      case "REFRESH_ENTITLEMENTS":
        this.logger.log(
          `[no-op] REFRESH_ENTITLEMENTS for event ${event.id} - entitlements are resolved live`,
        );
        return;
      default:
        throw new Error(`Unknown automation action "${descriptor.action}"`);
    }
  }
}
