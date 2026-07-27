-- CreateEnum
CREATE TYPE "ApplicationMemberRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'TESTER', 'SUPPORT', 'VIEWER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationVisibility" AS ENUM ('PRIVATE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ApplicationEnvironmentType" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ApplicationSecretType" AS ENUM ('API_KEY', 'WEBHOOK_SECRET', 'JWT_SECRET', 'OAUTH_CREDENTIAL', 'PAYMENT_CREDENTIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DomainSslStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_MEMBER_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_MEMBER_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_MEMBER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_VERSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_VERSION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_VERSION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_ENVIRONMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_ENVIRONMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_DOMAIN_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_DOMAIN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_DOMAIN_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_DOMAIN_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_SECRET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_SECRET_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_SECRET_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_SETTING_UPDATED';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "applicationId" TEXT;

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "category" TEXT,
    "bundleIdentifier" TEXT,
    "packageName" TEXT,
    "webIdentifier" TEXT,
    "logoUrl" TEXT,
    "iconUrl" TEXT,
    "primaryColor" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "ApplicationVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_versions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "track" TEXT NOT NULL DEFAULT 'stable',
    "androidVersion" TEXT,
    "iosVersion" TEXT,
    "webVersion" TEXT,
    "buildNumber" TEXT,
    "minimumSupportedVersion" TEXT,
    "releaseNotes" TEXT,
    "releaseDate" TIMESTAMP(3),
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_environments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "ApplicationEnvironmentType" NOT NULL,
    "baseUrl" TEXT,
    "apiUrl" TEXT,
    "variables" JSONB,
    "featureFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_secrets" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "environmentId" TEXT,
    "type" "ApplicationSecretType" NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastFour" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "application_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_domains" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sslStatus" "DomainSslStatus" NOT NULL DEFAULT 'PENDING',
    "verificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_settings" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_members" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ApplicationMemberRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_slug_key" ON "applications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "applications_bundleIdentifier_key" ON "applications"("bundleIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "applications_packageName_key" ON "applications"("packageName");

-- CreateIndex
CREATE UNIQUE INDEX "applications_webIdentifier_key" ON "applications"("webIdentifier");

-- CreateIndex
CREATE INDEX "applications_organizationId_idx" ON "applications"("organizationId");

-- CreateIndex
CREATE INDEX "application_versions_applicationId_idx" ON "application_versions"("applicationId");

-- CreateIndex
CREATE INDEX "application_versions_applicationId_track_idx" ON "application_versions"("applicationId", "track");

-- CreateIndex
CREATE UNIQUE INDEX "application_environments_applicationId_type_key" ON "application_environments"("applicationId", "type");

-- CreateIndex
CREATE INDEX "application_secrets_applicationId_idx" ON "application_secrets"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_secrets_applicationId_environmentId_key_key" ON "application_secrets"("applicationId", "environmentId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "application_domains_domain_key" ON "application_domains"("domain");

-- CreateIndex
CREATE INDEX "application_domains_applicationId_idx" ON "application_domains"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_settings_applicationId_key_key" ON "application_settings"("applicationId", "key");

-- CreateIndex
CREATE INDEX "application_members_userId_idx" ON "application_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "application_members_applicationId_userId_key" ON "application_members"("applicationId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_applicationId_idx" ON "audit_logs"("applicationId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_versions" ADD CONSTRAINT "application_versions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_versions" ADD CONSTRAINT "application_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_environments" ADD CONSTRAINT "application_environments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_secrets" ADD CONSTRAINT "application_secrets_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_secrets" ADD CONSTRAINT "application_secrets_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_secrets" ADD CONSTRAINT "application_secrets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_domains" ADD CONSTRAINT "application_domains_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
