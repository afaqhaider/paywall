-- AlterEnum
ALTER TYPE "FinancialEventType" ADD VALUE 'REFUND_PARTIAL';
ALTER TYPE "FinancialEventType" ADD VALUE 'CHARGEBACK_CREATED';
ALTER TYPE "FinancialEventType" ADD VALUE 'CHARGEBACK_REVERSED';

-- AlterTable
ALTER TABLE "financial_events" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "financial_events_idempotencyKey_key" ON "financial_events"("idempotencyKey");
