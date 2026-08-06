import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { RuntimeApiController } from "./runtime-api.controller";
import { RuntimeApiService } from "./runtime-api.service";

@Module({
  imports: [EntitlementsModule],
  controllers: [RuntimeApiController],
  providers: [RuntimeApiService],
})
export class RuntimeApiModule {}
