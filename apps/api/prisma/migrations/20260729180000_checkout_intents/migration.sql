-- CreateEnum
CREATE TYPE "CheckoutIntentStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "checkout_intents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "status" "CheckoutIntentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_intents_checkoutSessionId_key" ON "checkout_intents"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "checkout_intents_organizationId_idx" ON "checkout_intents"("organizationId");

-- CreateIndex
CREATE INDEX "checkout_intents_status_idx" ON "checkout_intents"("status");

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "payment_checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
