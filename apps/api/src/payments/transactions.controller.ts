import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { TransactionsService } from "./transactions.service";
import { CreateManualTransactionDto } from "./dto/create-manual-transaction.dto";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateManualTransactionDto,
  ) {
    return this.transactionsService.createManual(organizationId, dto);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.transactionsService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":transactionId")
  async getOne(
    @Param("transactionId") transactionId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.transactionsService.getOne(transactionId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":transactionId/mark-succeeded")
  @HttpCode(HttpStatus.OK)
  async markSucceeded(
    @Param("transactionId") transactionId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.transactionsService.markSucceeded(transactionId, organizationId);
  }
}
