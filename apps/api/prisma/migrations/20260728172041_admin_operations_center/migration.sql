-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('MAINTENANCE', 'INCIDENT', 'FEATURE_RELEASE', 'GENERAL_NOTICE');

-- CreateEnum
CREATE TYPE "MessageTemplateType" AS ENUM ('EMAIL', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "ImpersonationTargetRole" AS ENUM ('CUSTOMER', 'DEVELOPER');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'SUSPENDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_ADMIN_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_ADMIN_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_SOFT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_OWNERSHIP_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_SUSPENDED_BY_ADMIN';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_MOVED_TO_ORGANIZATION';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_FORCE_LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_2FA_RESET_BY_ADMIN';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_IMPERSONATION_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_IMPERSONATION_ENDED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_LOGIN_LINK_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_ACCOUNT_UNLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_PASSWORD_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_SESSIONS_INVALIDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_ADMIN_ACTION';
ALTER TYPE "AuditAction" ADD VALUE 'LICENSE_ADMIN_ACTION';
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_SETTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'FEATURE_FLAG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ANNOUNCEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ANNOUNCEMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ANNOUNCEMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCIAL_SYNC_ADMIN_RETRIED';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformAdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetRole" "ImpersonationTargetRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rolloutPercentage" INTEGER,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "type" "MessageTemplateType" NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_announcements" (
    "id" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_userId_key" ON "platform_admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "impersonation_sessions_tokenHash_key" ON "impersonation_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "impersonation_sessions_adminUserId_idx" ON "impersonation_sessions"("adminUserId");

-- CreateIndex
CREATE INDEX "impersonation_sessions_targetUserId_idx" ON "impersonation_sessions"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_type_key_key" ON "message_templates"("type", "key");

-- CreateIndex
CREATE INDEX "platform_announcements_type_idx" ON "platform_announcements"("type");

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
