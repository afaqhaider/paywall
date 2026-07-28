import { Module } from "@nestjs/common";
import { AllowedOriginsController } from "./allowed-origins.controller";
import { AllowedOriginsService } from "./allowed-origins.service";

@Module({
  controllers: [AllowedOriginsController],
  providers: [AllowedOriginsService],
})
export class AllowedOriginsModule {}
