import { Module } from "@nestjs/common";
import { DeveloperProfileController } from "./developer-profile.controller";
import { DeveloperProfileService } from "./developer-profile.service";

@Module({
  controllers: [DeveloperProfileController],
  providers: [DeveloperProfileService],
})
export class DeveloperProfileModule {}
