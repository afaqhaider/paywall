-- CreateEnum
CREATE TYPE "EntitlementGrantSource" AS ENUM ('SUBSCRIPTION', 'TRIAL', 'MANUAL', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "EntitlementGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION', 'SEAT', 'DEVICE', 'LIFETIME', 'TRIAL', 'ENTERPRISE', 'TEMPORARY', 'MANUAL');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'PENDING', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SeatAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "UsageResetPolicy" AS ENUM ('NEVER', 'MONTHLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'DESKTOP', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ENTITLEMENT_GRANT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ENTITLEMENT_GRANT_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_KEY_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'SEAT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'SEAT_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'SEAT_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_REGISTERED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'USAGE_LIMIT_UPDATED';

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" TEXT NOT NULL,
    "entitlementDefinitionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "source" "EntitlementGrantSource" NOT NULL,
    "status" "EntitlementGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "boolValue" BOOLEAN,
    "numberValue" INTEGER,
    "textValue" TEXT,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grant_events" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_grant_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_access" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "entitlementDefinitionId" TEXT NOT NULL,
    "hasAccess" BOOLEAN NOT NULL,
    "numberValue" INTEGER,
    "textValue" TEXT,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "sourceGrantId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "type" "LicenseType" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "seatLimit" INTEGER,
    "deviceLimit" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_assignments" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "license_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_assignments" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SeatAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_limits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "entitlementDefinitionId" TEXT NOT NULL,
    "limitValue" INTEGER,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "resetPolicy" "UsageResetPolicy" NOT NULL DEFAULT 'NEVER',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "entitlementDefinitionId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "apiClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "rateLimitPerMin" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_scopes" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_keys" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "displayCode" TEXT NOT NULL,
    "activationLimit" INTEGER NOT NULL DEFAULT 1,
    "activationCount" INTEGER NOT NULL DEFAULT 0,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_registrations" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "licenseId" TEXT,
    "deviceId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "appVersion" TEXT,
    "osVersion" TEXT,
    "pushToken" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "applicationId" TEXT,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "entitlementDefinitionId" TEXT,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grants_idempotencyKey_key" ON "entitlement_grants"("idempotencyKey");

-- CreateIndex
CREATE INDEX "entitlement_grants_organizationId_applicationId_idx" ON "entitlement_grants"("organizationId", "applicationId");

-- CreateIndex
CREATE INDEX "entitlement_grants_entitlementDefinitionId_idx" ON "entitlement_grants"("entitlementDefinitionId");

-- CreateIndex
CREATE INDEX "entitlement_grants_subscriptionId_idx" ON "entitlement_grants"("subscriptionId");

-- CreateIndex
CREATE INDEX "entitlement_grants_status_idx" ON "entitlement_grants"("status");

-- CreateIndex
CREATE INDEX "entitlement_grant_events_grantId_idx" ON "entitlement_grant_events"("grantId");

-- CreateIndex
CREATE INDEX "feature_access_applicationId_idx" ON "feature_access"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_access_organizationId_applicationId_entitlementDefi_key" ON "feature_access"("organizationId", "applicationId", "entitlementDefinitionId");

-- CreateIndex
CREATE INDEX "licenses_organizationId_idx" ON "licenses"("organizationId");

-- CreateIndex
CREATE INDEX "licenses_applicationId_idx" ON "licenses"("applicationId");

-- CreateIndex
CREATE INDEX "licenses_subscriptionId_idx" ON "licenses"("subscriptionId");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE INDEX "license_assignments_userId_idx" ON "license_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "license_assignments_licenseId_userId_key" ON "license_assignments"("licenseId", "userId");

-- CreateIndex
CREATE INDEX "seats_licenseId_idx" ON "seats"("licenseId");

-- CreateIndex
CREATE INDEX "seats_status_idx" ON "seats"("status");

-- CreateIndex
CREATE INDEX "seat_assignments_seatId_idx" ON "seat_assignments"("seatId");

-- CreateIndex
CREATE INDEX "seat_assignments_userId_idx" ON "seat_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_limits_organizationId_applicationId_entitlementDefini_key" ON "usage_limits"("organizationId", "applicationId", "entitlementDefinitionId");

-- CreateIndex
CREATE INDEX "usage_counters_subscriptionId_idx" ON "usage_counters"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_organizationId_applicationId_entitlementDefi_key" ON "usage_counters"("organizationId", "applicationId", "entitlementDefinitionId");

-- CreateIndex
CREATE INDEX "api_clients_organizationId_idx" ON "api_clients"("organizationId");

-- CreateIndex
CREATE INDEX "api_clients_applicationId_idx" ON "api_clients"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_apiClientId_idx" ON "api_keys"("apiClientId");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_scopes_apiKeyId_scope_key" ON "api_key_scopes"("apiKeyId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "license_keys_keyHash_key" ON "license_keys"("keyHash");

-- CreateIndex
CREATE INDEX "license_keys_licenseId_idx" ON "license_keys"("licenseId");

-- CreateIndex
CREATE INDEX "device_registrations_userId_idx" ON "device_registrations"("userId");

-- CreateIndex
CREATE INDEX "device_registrations_licenseId_idx" ON "device_registrations"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "device_registrations_applicationId_deviceId_key" ON "device_registrations"("applicationId", "deviceId");

-- CreateIndex
CREATE INDEX "access_logs_organizationId_idx" ON "access_logs"("organizationId");

-- CreateIndex
CREATE INDEX "access_logs_applicationId_idx" ON "access_logs"("applicationId");

-- CreateIndex
CREATE INDEX "access_logs_apiKeyId_idx" ON "access_logs"("apiKeyId");

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "entitlement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grant_events" ADD CONSTRAINT "entitlement_grant_events_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "entitlement_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grant_events" ADD CONSTRAINT "entitlement_grant_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_access" ADD CONSTRAINT "feature_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_access" ADD CONSTRAINT "feature_access_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_access" ADD CONSTRAINT "feature_access_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "entitlement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_limits" ADD CONSTRAINT "usage_limits_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_limits" ADD CONSTRAINT "usage_limits_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "entitlement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "entitlement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_scopes" ADD CONSTRAINT "api_key_scopes_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_keys" ADD CONSTRAINT "license_keys_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
