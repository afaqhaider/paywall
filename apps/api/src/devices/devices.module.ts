import { Module } from "@nestjs/common";
import { DevicesController } from "./devices.controller";
import { PublicDevicesController } from "./public-devices.controller";
import { DevicesService } from "./devices.service";
import { ApiKeySystemActorService } from "../common/services/api-key-system-actor.service";

@Module({
  controllers: [DevicesController, PublicDevicesController],
  providers: [DevicesService, ApiKeySystemActorService],
  exports: [DevicesService],
})
export class DevicesModule {}
