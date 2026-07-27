import { Controller, Get, HttpCode, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import type { HealthStatus } from "@paywall/types";
import type { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const result = await this.healthService.check();
    if (result.status === "error") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
