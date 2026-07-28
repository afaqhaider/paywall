-- CreateEnum
CREATE TYPE "DeveloperInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'EXHAUSTED');

-- AlterEnum
ALTER TYPE "ApplicationEnvironmentType" ADD VALUE 'SANDBOX';

-- AlterEnum
ALTER TYPE "ApplicationMemberRole" ADD VALUE 'MAINTAINER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DEVELOPER_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVELOPER_INVITATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVELOPER_INVITATION_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVELOPER_INVITATION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVELOPER_INVITATION_RESENT';
ALTER TYPE "AuditAction" ADD VALUE 'ENVIRONMENT_VARIABLE_SET';
ALTER TYPE "AuditAction" ADD VALUE 'ENVIRONMENT_VARIABLE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'ALLOWED_ORIGIN_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'ALLOWED_ORIGIN_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_APPLICATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_APPLICATION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CREDENTIAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CREDENTIAL_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CREDENTIAL_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'REDIRECT_URI_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'REDIRECT_URI_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'CALLBACK_URL_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CALLBACK_URL_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_ENDPOINT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_ENDPOINT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_ENDPOINT_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_ENDPOINT_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_ENDPOINT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_SECRET_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'WEBHOOK_DELIVERY_RETRIED';

-- CreateTable
CREATE TABLE "developer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "companyName" TEXT,
    "websiteUrl" TEXT,
    "githubUrl" TEXT,
    "supportEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_invitations" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ApplicationMemberRole" NOT NULL DEFAULT 'DEVELOPER',
    "tokenHash" TEXT NOT NULL,
    "status" "DeveloperInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_variables" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environment_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_origins" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "environmentId" TEXT,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_applications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_credentials" (
    "id" TEXT NOT NULL,
    "oauthApplicationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirect_uris" (
    "id" TEXT NOT NULL,
    "oauthApplicationId" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirect_uris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callback_urls" (
    "id" TEXT NOT NULL,
    "oauthApplicationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callback_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "environmentId" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "eventTypes" TEXT[],
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ENABLED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_secrets" (
    "id" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_retries" (
    "id" TEXT NOT NULL,
    "webhookDeliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "responseStatus" INTEGER,
    "error" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_retries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_profiles_userId_key" ON "developer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "developer_invitations_tokenHash_key" ON "developer_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "developer_invitations_applicationId_idx" ON "developer_invitations"("applicationId");

-- CreateIndex
CREATE INDEX "developer_invitations_email_idx" ON "developer_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "environment_variables_environmentId_key_key" ON "environment_variables"("environmentId", "key");

-- CreateIndex
CREATE INDEX "allowed_origins_applicationId_idx" ON "allowed_origins"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_origins_applicationId_environmentId_origin_key" ON "allowed_origins"("applicationId", "environmentId", "origin");

-- CreateIndex
CREATE INDEX "oauth_applications_applicationId_idx" ON "oauth_applications"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_credentials_clientId_key" ON "oauth_credentials"("clientId");

-- CreateIndex
CREATE INDEX "oauth_credentials_oauthApplicationId_idx" ON "oauth_credentials"("oauthApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "redirect_uris_oauthApplicationId_uri_key" ON "redirect_uris"("oauthApplicationId", "uri");

-- CreateIndex
CREATE UNIQUE INDEX "callback_urls_oauthApplicationId_url_key" ON "callback_urls"("oauthApplicationId", "url");

-- CreateIndex
CREATE INDEX "webhook_endpoints_applicationId_idx" ON "webhook_endpoints"("applicationId");

-- CreateIndex
CREATE INDEX "webhook_secrets_webhookEndpointId_idx" ON "webhook_secrets"("webhookEndpointId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookEndpointId_idx" ON "webhook_deliveries"("webhookEndpointId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookEndpointId_status_idx" ON "webhook_deliveries"("webhookEndpointId", "status");

-- CreateIndex
CREATE INDEX "webhook_retries_webhookDeliveryId_idx" ON "webhook_retries"("webhookDeliveryId");

-- AddForeignKey
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_invitations" ADD CONSTRAINT "developer_invitations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_invitations" ADD CONSTRAINT "developer_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_invitations" ADD CONSTRAINT "developer_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_origins" ADD CONSTRAINT "allowed_origins_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_origins" ADD CONSTRAINT "allowed_origins_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_credentials" ADD CONSTRAINT "oauth_credentials_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirect_uris" ADD CONSTRAINT "redirect_uris_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "callback_urls" ADD CONSTRAINT "callback_urls_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_secrets" ADD CONSTRAINT "webhook_secrets_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_retries" ADD CONSTRAINT "webhook_retries_webhookDeliveryId_fkey" FOREIGN KEY ("webhookDeliveryId") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
