import { Module } from "@nestjs/common";
import { ApiClientsController, ApiKeysController } from "./api-keys.controller";
import { ApiClientsService } from "./api-clients.service";
import { ApiKeysService } from "./api-keys.service";

@Module({
  controllers: [ApiClientsController, ApiKeysController],
  providers: [ApiClientsService, ApiKeysService],
  exports: [ApiClientsService, ApiKeysService],
})
export class ApiKeysModule {}
