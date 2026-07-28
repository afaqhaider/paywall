import { Module } from "@nestjs/common";
import { FinancialEventsController } from "./financial-events.controller";
import { FinancialEventsService } from "./financial-events.service";
import { FinancialSyncController } from "./financial-sync.controller";
import { FinancialSyncService } from "./financial-sync.service";
import { SyncEngineService } from "./sync-engine.service";
import { ErpConnectorModule } from "../erp-connector/erp-connector.module";

/**
 * Financial event recording + the sync engine that drains them toward the
 * org's configured provider (INTERNAL or LEDGIX_ERP, via `ErpConnectorModule`).
 * `FinancialEventsService.record()` is called explicitly by whoever has a
 * financial event to report - this module does not hook into the payment/
 * subscription webhook pipeline itself (that wiring is out of scope here,
 * same as Phase 7's `WebhookDispatchService.enqueue()`).
 */
@Module({
  imports: [ErpConnectorModule],
  controllers: [FinancialEventsController, FinancialSyncController],
  providers: [FinancialEventsService, FinancialSyncService, SyncEngineService],
  exports: [FinancialEventsService],
})
export class FinancialEventsModule {}
