-- DropIndex
DROP INDEX "commission_ledger_entries_paymentTransactionId_key";

-- CreateIndex
CREATE INDEX "commission_ledger_entries_paymentTransactionId_idx" ON "commission_ledger_entries"("paymentTransactionId");
