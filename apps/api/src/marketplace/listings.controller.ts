import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { ListingsService } from "./listings.service";
import { UpsertListingDto } from "./dto/upsert-listing.dto";
import { AddMediaDto } from "./dto/add-media.dto";
import { AddChangelogDto } from "./dto/add-changelog.dto";
import { InviteToListingDto } from "./dto/invite-to-listing.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("organizations/:organizationId/applications/:applicationId/listing")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Get()
  async get(@Param("applicationId") applicationId: string) {
    return this.listingsService.getForApplication(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Put()
  async upsert(
    @Param("applicationId") applicationId: string,
    @Body() dto: UpsertListingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.listingsService.upsert(applicationId, dto, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post("publish")
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.listingsService.publish(applicationId, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post("unpublish")
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.listingsService.unpublish(applicationId, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post("archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.listingsService.archive(applicationId, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Put("categories")
  async setCategories(
    @Param("applicationId") applicationId: string,
    @Body("categoryIds") categoryIds: string[],
  ) {
    return this.listingsService.setCategories(applicationId, categoryIds ?? []);
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Put("tags")
  async setTags(@Param("applicationId") applicationId: string, @Body("tagIds") tagIds: string[]) {
    return this.listingsService.setTags(applicationId, tagIds ?? []);
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Post("media")
  async addMedia(@Param("applicationId") applicationId: string, @Body() dto: AddMediaDto) {
    return this.listingsService.addMedia(applicationId, dto);
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Delete("media/:mediaId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMedia(
    @Param("applicationId") applicationId: string,
    @Param("mediaId") mediaId: string,
  ) {
    await this.listingsService.removeMedia(applicationId, mediaId);
  }

  @RequireAppRole(ApplicationMemberRole.MAINTAINER)
  @Post("changelogs")
  async addChangelog(@Param("applicationId") applicationId: string, @Body() dto: AddChangelogDto) {
    return this.listingsService.addChangelog(applicationId, dto);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post("invites")
  async invite(
    @Param("applicationId") applicationId: string,
    @Body() dto: InviteToListingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listingsService.invite(applicationId, dto, user.id);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete("invites/:inviteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(
    @Param("applicationId") applicationId: string,
    @Param("inviteId") inviteId: string,
  ) {
    await this.listingsService.revokeInvite(applicationId, inviteId);
  }
}
