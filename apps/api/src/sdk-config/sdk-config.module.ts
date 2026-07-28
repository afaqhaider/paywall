import { Module } from "@nestjs/common";
import { SdkConfigController } from "./sdk-config.controller";
import { SdkConfigService } from "./sdk-config.service";

@Module({
  controllers: [SdkConfigController],
  providers: [SdkConfigService],
})
export class SdkConfigModule {}
