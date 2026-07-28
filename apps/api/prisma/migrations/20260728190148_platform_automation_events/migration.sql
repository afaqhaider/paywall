-- CreateEnum
CREATE TYPE "PlatformEventType" AS ENUM ('USER_CREATED', 'ORGANIZATION_CREATED', 'ORGANIZATION_SUSPENDED', 'APPLICATION_CREATED', 'APPLICATION_ARCHIVED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_EXPIRED', 'TRIAL_STARTED', 'TRIAL_ENDED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'REFUND_CREATED', 'CHARGEBACK_CREATED', 'INVOICE_CREATED', 'RECEIPT_CREATED', 'LICENSE_CREATED', 'LICENSE_ACTIVATED', 'LICENSE_REVOKED', 'DEVICE_REGISTERED', 'DEVICE_REMOVED', 'API_KEY_CREATED', 'WEBHOOK_CREATED', 'WEBHOOK_DELIVERED', 'FINANCIAL_SYNC_STARTED', 'FINANCIAL_SYNC_SUCCEEDED', 'FINANCIAL_SYNC_FAILED', 'ERP_CONNECTED', 'ERP_DISCONNECTED', 'NOTIFICATION_REQUESTED');

-- CreateEnum
CREATE TYPE "PlatformEventStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'SUCCESS', 'RETRYING', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP', 'WEBHOOK', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('WELCOME', 'PASSWORD_RESET', 'INVOICE', 'RECEIPT', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_EXPIRING', 'TRIAL_ENDING', 'PAYMENT_FAILED', 'ERP_SYNC_FAILED', 'PLATFORM_ANNOUNCEMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_TOGGLED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_TEMPLATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKGROUND_JOB_RETRIED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKGROUND_JOB_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_RESUMED';

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "type" "PlatformEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "organizationId" TEXT,
    "applicationId" TEXT,
    "customerId" TEXT,
    "status" "PlatformEventStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "queueName" TEXT NOT NULL DEFAULT 'default',
    "runAt" TIMESTAMP(3),
    "cron" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "error" TEXT,
    "correlationId" TEXT,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_history_entries" (
    "id" TEXT NOT NULL,
    "backgroundJobId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEventType" "PlatformEventType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "actions" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rule_executions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL,
    "actionsRun" INTEGER NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "automation_rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notifications" (
    "id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "recipientUserId" TEXT,
    "organizationId" TEXT,
    "customerId" TEXT,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_controls" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pausedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_controls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_events_type_idx" ON "platform_events"("type");

-- CreateIndex
CREATE INDEX "platform_events_organizationId_idx" ON "platform_events"("organizationId");

-- CreateIndex
CREATE INDEX "platform_events_applicationId_idx" ON "platform_events"("applicationId");

-- CreateIndex
CREATE INDEX "platform_events_customerId_idx" ON "platform_events"("customerId");

-- CreateIndex
CREATE INDEX "platform_events_correlationId_idx" ON "platform_events"("correlationId");

-- CreateIndex
CREATE INDEX "platform_events_status_idx" ON "platform_events"("status");

-- CreateIndex
CREATE INDEX "background_jobs_status_idx" ON "background_jobs"("status");

-- CreateIndex
CREATE INDEX "background_jobs_queueName_idx" ON "background_jobs"("queueName");

-- CreateIndex
CREATE INDEX "background_jobs_nextAttemptAt_idx" ON "background_jobs"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "background_jobs_priority_idx" ON "background_jobs"("priority");

-- CreateIndex
CREATE INDEX "background_jobs_correlationId_idx" ON "background_jobs"("correlationId");

-- CreateIndex
CREATE INDEX "job_history_entries_backgroundJobId_idx" ON "job_history_entries"("backgroundJobId");

-- CreateIndex
CREATE INDEX "automation_rules_triggerEventType_idx" ON "automation_rules"("triggerEventType");

-- CreateIndex
CREATE INDEX "automation_rules_enabled_idx" ON "automation_rules"("enabled");

-- CreateIndex
CREATE INDEX "automation_rule_executions_ruleId_idx" ON "automation_rule_executions"("ruleId");

-- CreateIndex
CREATE INDEX "automation_rule_executions_eventId_idx" ON "automation_rule_executions"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_key" ON "notification_templates"("key");

-- CreateIndex
CREATE INDEX "notification_templates_category_idx" ON "notification_templates"("category");

-- CreateIndex
CREATE INDEX "platform_notifications_recipientUserId_idx" ON "platform_notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "platform_notifications_organizationId_idx" ON "platform_notifications"("organizationId");

-- CreateIndex
CREATE INDEX "platform_notifications_customerId_idx" ON "platform_notifications"("customerId");

-- CreateIndex
CREATE INDEX "platform_notifications_category_idx" ON "platform_notifications"("category");

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_idx" ON "notification_deliveries"("channel");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "queue_controls_queueName_key" ON "queue_controls"("queueName");

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "platform_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_history_entries" ADD CONSTRAINT "job_history_entries_backgroundJobId_fkey" FOREIGN KEY ("backgroundJobId") REFERENCES "background_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "platform_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_notifications" ADD CONSTRAINT "platform_notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "platform_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_controls" ADD CONSTRAINT "queue_controls_pausedById_fkey" FOREIGN KEY ("pausedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

