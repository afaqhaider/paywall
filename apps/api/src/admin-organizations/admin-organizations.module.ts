import { Module } from "@nestjs/common";
import { AdminOrganizationsController } from "./admin-organizations.controller";
import { AdminOrganizationsService } from "./admin-organizations.service";

@Module({
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
})
export class AdminOrganizationsModule {}
