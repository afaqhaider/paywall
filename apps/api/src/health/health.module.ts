import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  // Exported so Phase 9's admin-monitoring module can inject the same DB
  // health check directly instead of re-implementing `SELECT 1`.
  exports: [HealthService],
})
export class HealthModule {}
