import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { PlatformSearchService } from "./platform-search.service";

@UseGuards(PlatformAdminGuard)
@Controller("admin/search")
export class PlatformSearchController {
  constructor(private readonly platformSearchService: PlatformSearchService) {}

  @Get()
  async search(@Query("q") q: string | undefined, @Query("types") types: string | undefined) {
    const parsedTypes = types
      ? types
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    return this.platformSearchService.search(q ?? "", parsedTypes);
  }
}
