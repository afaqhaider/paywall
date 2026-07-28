import { Module } from "@nestjs/common";
import { FinancialIntegrationController } from "./financial-integration.controller";
import { FinancialIntegrationService } from "./financial-integration.service";
import { ErpConnectionController } from "./erp-connection.controller";
import { ErpConnectionService } from "./erp-connection.service";

@Module({
  controllers: [FinancialIntegrationController, ErpConnectionController],
  providers: [FinancialIntegrationService, ErpConnectionService],
})
export class FinancialIntegrationModule {}
