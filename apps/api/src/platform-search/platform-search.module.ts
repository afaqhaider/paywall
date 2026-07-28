import { Module } from "@nestjs/common";
import { PlatformSearchController } from "./platform-search.controller";
import { PlatformSearchService } from "./platform-search.service";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@Module({
  controllers: [PlatformSearchController],
  providers: [PlatformSearchService, PlatformAdminGuard],
  exports: [PlatformSearchService],
})
export class PlatformSearchModule {}
