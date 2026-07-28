import { Module } from "@nestjs/common";
import { LedgixErpConnectorService } from "./ledgix-erp-connector.service";

/**
 * The LedGix ERP HTTP client. Exported only for `financial-events`' queue
 * processor to consume - never import `LedgixErpConnectorService` from the
 * Customer Portal or anywhere else; that agent reads sync state from Prisma
 * (`FinancialSync`/`FinancialEvent.payload`) rather than calling out live.
 */
@Module({
  providers: [LedgixErpConnectorService],
  exports: [LedgixErpConnectorService],
})
export class ErpConnectorModule {}
