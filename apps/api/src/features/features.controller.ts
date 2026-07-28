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
import { ApplicationMemberRole, OrganizationRole } from "@prisma/client";
import { FeaturesService } from "./features.service";
import { PlanFeaturesService } from "./plan-features.service";
import { EntitlementDefinitionsService } from "./entitlement-definitions.service";
import { CreateFeatureDto } from "./dto/create-feature.dto";
import { UpdateFeatureDto } from "./dto/update-feature.dto";
import { UpsertPlanFeatureDto } from "./dto/upsert-plan-feature.dto";
import { CreateEntitlementDefinitionDto } from "./dto/create-entitlement-definition.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/features")
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeatureDto,
    @Req() req: Request,
  ) {
    return this.featuresService.create(applicationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.featuresService.list(applicationId);
  }
}

@UseGuards(
  OrgScopedGuard("featureId", (p: PrismaService, id: string) =>
    p.feature
      .findUnique({ where: { id }, include: { application: true } })
      .then((r) => r?.application.organizationId ?? null),
  ),
)
@Controller("features/:featureId")
export class FeatureController {
  constructor(private readonly featuresService: FeaturesService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async getOne(@Param("featureId") featureId: string) {
    return this.featuresService.getOne(featureId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch()
  async update(
    @Param("featureId") featureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFeatureDto,
    @Req() req: Request,
  ) {
    return this.featuresService.update(featureId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("featureId") featureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.featuresService.archive(featureId, user.id, extractRequestMeta(req));
  }
}

@UseGuards(
  OrgScopedGuard("planId", (p: PrismaService, id: string) =>
    p.plan
      .findUnique({ where: { id }, include: { product: true } })
      .then((r) => r?.product.organizationId ?? null),
  ),
)
@Controller("plans/:planId/features")
export class PlanFeaturesController {
  constructor(private readonly planFeaturesService: PlanFeaturesService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("planId") planId: string) {
    return this.planFeaturesService.list(planId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async upsert(@Param("planId") planId: string, @Body() dto: UpsertPlanFeatureDto) {
    return this.planFeaturesService.upsert(planId, dto);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete(":featureId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("planId") planId: string, @Param("featureId") featureId: string) {
    await this.planFeaturesService.remove(planId, featureId);
  }
}

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/entitlement-definitions")
export class EntitlementDefinitionsController {
  constructor(private readonly entitlementDefinitionsService: EntitlementDefinitionsService) {}

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEntitlementDefinitionDto,
    @Req() req: Request,
  ) {
    return this.entitlementDefinitionsService.create(
      applicationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.entitlementDefinitionsService.list(applicationId);
  }
}
