import { Controller, Get, Param, Query } from "@nestjs/common";
import { CustomerFinancialsService } from "./customer-financials.service";
import { FinancialListQueryDto } from "./dto/financial-list-query.dto";
import { TransactionListQueryDto } from "./dto/transaction-list-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId")
export class CustomerFinancialsController {
  constructor(private readonly financialsService: CustomerFinancialsService) {}

  @Get("invoices")
  async listInvoices(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialListQueryDto,
  ) {
    return this.financialsService.listInvoices(customerId, user.id, query);
  }

  @Get("invoices/:invoiceId/download")
  async downloadInvoice(
    @Param("customerId") customerId: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialsService.downloadInvoice(customerId, invoiceId, user.id);
  }

  @Get("receipts")
  async listReceipts(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinancialListQueryDto,
  ) {
    return this.financialsService.listReceipts(customerId, user.id, query);
  }

  @Get("receipts/:receiptId/download")
  async downloadReceipt(
    @Param("customerId") customerId: string,
    @Param("receiptId") receiptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financialsService.downloadReceipt(customerId, receiptId, user.id);
  }

  @Get("transactions")
  async listTransactions(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionListQueryDto,
  ) {
    return this.financialsService.listTransactions(customerId, user.id, query);
  }
}
