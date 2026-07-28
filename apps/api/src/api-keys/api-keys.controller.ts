import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { ApiClientsService } from "./api-clients.service";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiClientDto } from "./dto/create-api-client.dto";
import { UpdateApiClientDto } from "./dto/update-api-client.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { RotateApiKeyDto } from "./dto/rotate-api-key.dto";
import { AddApiKeyScopeDto } from "./dto/add-api-key-scope.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/api-clients")
export class ApiClientsController {
  constructor(private readonly apiClientsService: ApiClientsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiClientDto,
  ) {
    return this.apiClientsService.create(organizationId, user.id, dto);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string) {
    return this.apiClientsService.list(organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":apiClientId")
  async getOne(
    @Param("organizationId") organizationId: string,
    @Param("apiClientId") apiClientId: string,
  ) {
    return this.apiClientsService.getOne(organizationId, apiClientId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":apiClientId")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("apiClientId") apiClientId: string,
    @Body() dto: UpdateApiClientDto,
  ) {
    return this.apiClientsService.update(organizationId, apiClientId, dto);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":apiClientId")
  async remove(
    @Param("organizationId") organizationId: string,
    @Param("apiClientId") apiClientId: string,
  ) {
    await this.apiClientsService.remove(organizationId, apiClientId);
  }
}

const resolveApiClientOrg = async (prisma: PrismaService, apiClientId: string) => {
  const client = await prisma.aPIClient.findUnique({
    where: { id: apiClientId },
    select: { organizationId: true },
  });
  return client?.organizationId ?? null;
};

@UseGuards(OrgScopedGuard("apiClientId", resolveApiClientOrg))
@Controller("api-clients/:apiClientId/keys")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("apiClientId") apiClientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    return this.apiKeysService.create(apiClientId, dto, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("apiClientId") apiClientId: string) {
    return this.apiKeysService.list(apiClientId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":apiKeyId")
  async getOne(@Param("apiClientId") apiClientId: string, @Param("apiKeyId") apiKeyId: string) {
    return this.apiKeysService.getOne(apiClientId, apiKeyId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":apiKeyId/revoke")
  async revoke(
    @Param("apiClientId") apiClientId: string,
    @Param("apiKeyId") apiKeyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.apiKeysService.revoke(apiClientId, apiKeyId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":apiKeyId/rotate")
  async rotate(
    @Param("apiClientId") apiClientId: string,
    @Param("apiKeyId") apiKeyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RotateApiKeyDto,
    @Req() req: Request,
  ) {
    return this.apiKeysService.rotate(apiClientId, apiKeyId, dto, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":apiKeyId/scopes")
  async addScope(
    @Param("apiClientId") apiClientId: string,
    @Param("apiKeyId") apiKeyId: string,
    @Body() dto: AddApiKeyScopeDto,
  ) {
    return this.apiKeysService.addScope(apiClientId, apiKeyId, dto.scope);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":apiKeyId/scopes/:scope")
  async removeScope(
    @Param("apiClientId") apiClientId: string,
    @Param("apiKeyId") apiKeyId: string,
    @Param("scope") scope: string,
  ) {
    await this.apiKeysService.removeScope(apiClientId, apiKeyId, scope);
  }
}
