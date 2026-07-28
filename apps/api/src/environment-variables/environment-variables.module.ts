import { Module } from "@nestjs/common";
import { EnvironmentVariablesController } from "./environment-variables.controller";
import { EnvironmentVariablesService } from "./environment-variables.service";

@Module({
  controllers: [EnvironmentVariablesController],
  providers: [EnvironmentVariablesService],
})
export class EnvironmentVariablesModule {}
