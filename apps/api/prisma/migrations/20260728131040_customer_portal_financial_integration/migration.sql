-- CreateEnum
CREATE TYPE "FinancialProviderType" AS ENUM ('INTERNAL', 'LEDGIX_ERP');

-- CreateEnum
CREATE TYPE "ERPConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING_TEST', 'CONNECTED', 'FAILED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ERPResourceType" AS ENUM ('CUSTOMERS', 'SUPPLIERS', 'INVOICES', 'RECEIPTS', 'BANKS', 'PAYMENT_GATEWAYS', 'CURRENCIES', 'TAXES', 'COMPANY', 'CHART_OF_ACCOUNTS', 'PAYMENT_METHODS', 'JOURNAL_ENTRIES');

-- CreateEnum
CREATE TYPE "FinancialEventType" AS ENUM ('SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'REFUND_ISSUED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BILLING', 'SECURITY', 'SYNC', 'SYSTEM', 'GENERAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'FINANCIAL_INTEGRATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONNECTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONNECTION_TESTED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONNECTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONNECTION_CREDENTIAL_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONNECTION_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ERP_CONFIGURATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCIAL_EVENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCIAL_SYNC_RETRIED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCIAL_SYNC_DEAD_LETTERED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_RENAMED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_SELF_SERVICE_ACTION';

-- AlterEnum
ALTER TYPE "DeviceStatus" ADD VALUE 'REMOVED';

-- AlterTable
ALTER TABLE "device_registrations" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "financial_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "FinancialProviderType" NOT NULL DEFAULT 'INTERNAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_connections" (
    "id" TEXT NOT NULL,
    "financialIntegrationId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "ERPConnectionStatus" NOT NULL DEFAULT 'PENDING_TEST',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResult" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "erp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_companies" (
    "id" TEXT NOT NULL,
    "erpConnectionId" TEXT NOT NULL,
    "externalCompanyId" TEXT NOT NULL,
    "name" TEXT,
    "baseCurrency" TEXT,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_configurations" (
    "id" TEXT NOT NULL,
    "erpConnectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_permissions" (
    "id" TEXT NOT NULL,
    "erpConfigurationId" TEXT NOT NULL,
    "resource" "ERPResourceType" NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "erp_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "type" "FinancialEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "financialEventId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "dequeuedAt" TIMESTAMP(3),

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_syncs" (
    "id" TEXT NOT NULL,
    "financialEventId" TEXT NOT NULL,
    "erpConnectionId" TEXT,
    "provider" "FinancialProviderType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "erpReferenceNumber" TEXT,
    "erpInvoiceId" TEXT,
    "erpReceiptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "financial_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_history" (
    "id" TEXT NOT NULL,
    "financialSyncId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "requestSummary" JSONB,
    "responseSummary" JSONB,
    "error" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_errors" (
    "id" TEXT NOT NULL,
    "financialSyncId" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "sync_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "recoveryCodesHash" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_integrations_organizationId_key" ON "financial_integrations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_connections_financialIntegrationId_key" ON "erp_connections"("financialIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_companies_erpConnectionId_key" ON "erp_companies"("erpConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_configurations_erpConnectionId_key" ON "erp_configurations"("erpConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "erp_permissions_erpConfigurationId_resource_key" ON "erp_permissions"("erpConfigurationId", "resource");

-- CreateIndex
CREATE INDEX "financial_events_organizationId_idx" ON "financial_events"("organizationId");

-- CreateIndex
CREATE INDEX "financial_events_applicationId_idx" ON "financial_events"("applicationId");

-- CreateIndex
CREATE INDEX "financial_events_customerId_idx" ON "financial_events"("customerId");

-- CreateIndex
CREATE INDEX "financial_events_subscriptionId_idx" ON "financial_events"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_queue_financialEventId_key" ON "sync_queue"("financialEventId");

-- CreateIndex
CREATE INDEX "sync_queue_status_idx" ON "sync_queue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_syncs_financialEventId_key" ON "financial_syncs"("financialEventId");

-- CreateIndex
CREATE INDEX "financial_syncs_status_idx" ON "financial_syncs"("status");

-- CreateIndex
CREATE INDEX "financial_syncs_nextAttemptAt_idx" ON "financial_syncs"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "sync_history_financialSyncId_idx" ON "sync_history"("financialSyncId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_errors_financialSyncId_key" ON "sync_errors"("financialSyncId");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_credentials_userId_key" ON "two_factor_credentials"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "financial_integrations" ADD CONSTRAINT "financial_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_integrations" ADD CONSTRAINT "financial_integrations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_connections" ADD CONSTRAINT "erp_connections_financialIntegrationId_fkey" FOREIGN KEY ("financialIntegrationId") REFERENCES "financial_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_connections" ADD CONSTRAINT "erp_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_companies" ADD CONSTRAINT "erp_companies_erpConnectionId_fkey" FOREIGN KEY ("erpConnectionId") REFERENCES "erp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_configurations" ADD CONSTRAINT "erp_configurations_erpConnectionId_fkey" FOREIGN KEY ("erpConnectionId") REFERENCES "erp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_permissions" ADD CONSTRAINT "erp_permissions_erpConfigurationId_fkey" FOREIGN KEY ("erpConfigurationId") REFERENCES "erp_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_financialEventId_fkey" FOREIGN KEY ("financialEventId") REFERENCES "financial_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_syncs" ADD CONSTRAINT "financial_syncs_financialEventId_fkey" FOREIGN KEY ("financialEventId") REFERENCES "financial_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_syncs" ADD CONSTRAINT "financial_syncs_erpConnectionId_fkey" FOREIGN KEY ("erpConnectionId") REFERENCES "erp_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_history" ADD CONSTRAINT "sync_history_financialSyncId_fkey" FOREIGN KEY ("financialSyncId") REFERENCES "financial_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_financialSyncId_fkey" FOREIGN KEY ("financialSyncId") REFERENCES "financial_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_credentials" ADD CONSTRAINT "two_factor_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
