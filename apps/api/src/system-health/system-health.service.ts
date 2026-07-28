import { Inject, Injectable } from "@nestjs/common";
import type { HealthCheckResult, HealthProvider, HealthStatus } from "./health-provider.interface";

export const SYSTEM_HEALTH_PROVIDERS = "SYSTEM_HEALTH_PROVIDERS";

export interface SystemHealthSummary {
  status: HealthStatus;
  checkedAt: string;
  providers: HealthCheckResult[];
}

/**
 * Aggregates every registered `HealthProvider`. Adding a provider means
 * adding one class to the `SYSTEM_HEALTH_PROVIDERS` array in
 * system-health.module.ts - this service and the admin dashboard never
 * change (same DI multi-provider pattern as payment adapters).
 */
@Injectable()
export class SystemHealthService {
  constructor(@Inject(SYSTEM_HEALTH_PROVIDERS) private readonly providers: HealthProvider[]) {}

  async check(): Promise<SystemHealthSummary> {
    const results = await Promise.all(this.providers.map((provider) => provider.check()));

    const status: HealthStatus = results.some((r) => r.status === "DOWN")
      ? "DOWN"
      : results.some((r) => r.status === "DEGRADED")
        ? "DEGRADED"
        : "HEALTHY";

    return { status, checkedAt: new Date().toISOString(), providers: results };
  }

  async checkOne(name: string): Promise<HealthCheckResult | undefined> {
    const provider = this.providers.find((p) => p.name === name);
    return provider?.check();
  }
}
