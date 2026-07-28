import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { ProvidersService } from "./providers.service";
import { ProviderCredentialsService } from "./provider-credentials.service";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { CreateProviderAccountDto } from "./dto/create-provider-account.dto";
import { UpsertProviderCredentialDto } from "./dto/upsert-provider-credential.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/payment-providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProviderDto,
    @Req() req: Request,
  ) {
    return this.providersService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.providersService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":providerId")
  async getOne(
    @Param("providerId") providerId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.providersService.getOne(providerId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":providerId")
  async update(
    @Param("providerId") providerId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProviderDto,
    @Req() req: Request,
  ) {
    return this.providersService.update(
      providerId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":providerId/archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("providerId") providerId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.providersService.archive(
      providerId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}

const resolveProviderOrg = async (prisma: PrismaService, providerId: string) => {
  const provider = await prisma.paymentProvider.findUnique({
    where: { id: providerId },
    select: { organizationId: true },
  });
  return provider?.organizationId ?? null;
};

@UseGuards(OrgScopedGuard("providerId", resolveProviderOrg))
@Controller("payment-providers/:providerId/accounts")
export class ProviderAccountsController {
  constructor(private readonly providersService: ProvidersService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(@Param("providerId") providerId: string, @Body() dto: CreateProviderAccountDto) {
    return this.providersService.createAccount(providerId, dto);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("providerId") providerId: string) {
    return this.providersService.listAccounts(providerId);
  }
}

@UseGuards(OrgScopedGuard("providerId", resolveProviderOrg))
@Controller("payment-providers/:providerId/credentials")
export class ProviderCredentialsController {
  constructor(private readonly credentialsService: ProviderCredentialsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async upsert(
    @Param("providerId") providerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertProviderCredentialDto,
    @Req() req: Request,
  ) {
    return this.credentialsService.upsert(providerId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Get()
  async list(@Param("providerId") providerId: string) {
    return this.credentialsService.list(providerId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":credentialId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("providerId") providerId: string,
    @Param("credentialId") credentialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.credentialsService.remove(
      providerId,
      credentialId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
