-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INVITE_ONLY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('ICON', 'SCREENSHOT', 'VIDEO');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AnalyticsMetric" AS ENUM ('MRR', 'ARR', 'CHURN_RATE', 'TRIAL_CONVERSION_RATE', 'REVENUE', 'REFUND_RATE', 'CHARGEBACK_RATE', 'CUSTOMER_LIFETIME_VALUE', 'RETENTION_RATE', 'GROWTH_RATE', 'DAILY_ACTIVE_USERS', 'MONTHLY_ACTIVE_USERS', 'SEAT_UTILIZATION', 'LICENSE_USAGE', 'API_USAGE', 'WEBHOOK_VOLUME', 'STORAGE_USAGE', 'FINANCIAL_SYNC_SUCCESS_RATE');

-- CreateEnum
CREATE TYPE "AnalyticsScope" AS ENUM ('PLATFORM', 'ORGANIZATION', 'APPLICATION');

-- CreateEnum
CREATE TYPE "AnalyticsPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('REVENUE', 'SUBSCRIPTIONS', 'CUSTOMERS', 'APPLICATIONS', 'MARKETPLACE', 'FINANCIAL_SYNC', 'DEVELOPER_ACTIVITY', 'API_USAGE', 'LICENSE_USAGE', 'STORAGE');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'EXCEL', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LISTING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_UNPUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKETPLACE_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MARKETPLACE_TAG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'REVIEW_REPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'REVIEW_REPORT_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'WHITE_LABEL_CONFIG_UPDATED';

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ListingVisibility" NOT NULL DEFAULT 'PRIVATE',
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_categories" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "marketplace_listing_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_tags" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "marketplace_listing_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_media" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_changelogs" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_changelogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listing_invites" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_reviews" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_review_replies" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_review_reports" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "metric" "AnalyticsMetric" NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "organizationId" TEXT,
    "applicationId" TEXT,
    "period" "AnalyticsPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_requests" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB,
    "organizationId" TEXT,
    "requestedById" TEXT NOT NULL,
    "filename" TEXT,
    "mimeType" TEXT,
    "resultData" BYTEA,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brandName" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "customDomain" TEXT,
    "emailFromName" TEXT,
    "emailTemplates" JSONB,
    "marketplaceBranding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_applicationId_key" ON "marketplace_listings"("applicationId");

-- CreateIndex
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings"("status");

-- CreateIndex
CREATE INDEX "marketplace_listings_visibility_idx" ON "marketplace_listings"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_categories_name_key" ON "marketplace_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_categories_slug_key" ON "marketplace_categories"("slug");

-- CreateIndex
CREATE INDEX "marketplace_listing_categories_categoryId_idx" ON "marketplace_listing_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_categories_listingId_categoryId_key" ON "marketplace_listing_categories"("listingId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tags_name_key" ON "marketplace_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tags_slug_key" ON "marketplace_tags"("slug");

-- CreateIndex
CREATE INDEX "marketplace_listing_tags_tagId_idx" ON "marketplace_listing_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_tags_listingId_tagId_key" ON "marketplace_listing_tags"("listingId", "tagId");

-- CreateIndex
CREATE INDEX "marketplace_listing_media_listingId_idx" ON "marketplace_listing_media"("listingId");

-- CreateIndex
CREATE INDEX "marketplace_listing_changelogs_listingId_idx" ON "marketplace_listing_changelogs"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listing_invites_listingId_email_key" ON "marketplace_listing_invites"("listingId", "email");

-- CreateIndex
CREATE INDEX "marketplace_reviews_listingId_idx" ON "marketplace_reviews"("listingId");

-- CreateIndex
CREATE INDEX "marketplace_reviews_customerId_idx" ON "marketplace_reviews"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reviews_listingId_customerId_key" ON "marketplace_reviews"("listingId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_review_replies_reviewId_key" ON "marketplace_review_replies"("reviewId");

-- CreateIndex
CREATE INDEX "marketplace_review_reports_reviewId_idx" ON "marketplace_review_reports"("reviewId");

-- CreateIndex
CREATE INDEX "marketplace_review_reports_status_idx" ON "marketplace_review_reports"("status");

-- CreateIndex
CREATE INDEX "analytics_snapshots_metric_scope_idx" ON "analytics_snapshots"("metric", "scope");

-- CreateIndex
CREATE INDEX "analytics_snapshots_organizationId_idx" ON "analytics_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX "analytics_snapshots_applicationId_idx" ON "analytics_snapshots"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_metric_scope_organizationId_application_key" ON "analytics_snapshots"("metric", "scope", "organizationId", "applicationId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "report_requests_type_idx" ON "report_requests"("type");

-- CreateIndex
CREATE INDEX "report_requests_organizationId_idx" ON "report_requests"("organizationId");

-- CreateIndex
CREATE INDEX "report_requests_requestedById_idx" ON "report_requests"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_organizationId_key" ON "white_label_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_customDomain_key" ON "white_label_configs"("customDomain");

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_categories" ADD CONSTRAINT "marketplace_listing_categories_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_categories" ADD CONSTRAINT "marketplace_listing_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "marketplace_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_tags" ADD CONSTRAINT "marketplace_listing_tags_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_tags" ADD CONSTRAINT "marketplace_listing_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "marketplace_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_media" ADD CONSTRAINT "marketplace_listing_media_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_changelogs" ADD CONSTRAINT "marketplace_listing_changelogs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_invites" ADD CONSTRAINT "marketplace_listing_invites_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listing_invites" ADD CONSTRAINT "marketplace_listing_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review_replies" ADD CONSTRAINT "marketplace_review_replies_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "marketplace_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review_replies" ADD CONSTRAINT "marketplace_review_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review_reports" ADD CONSTRAINT "marketplace_review_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "marketplace_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review_reports" ADD CONSTRAINT "marketplace_review_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
