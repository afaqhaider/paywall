import { Injectable } from "@nestjs/common";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

/**
 * No external cache (Redis, etc.) is wired up in this platform - every
 * lookup goes straight to Postgres, and the only in-process maps (e.g.
 * `JobProcessorRegistryService`'s registry) aren't an external dependency
 * that can go down independently. This is a documented always-healthy stub
 * so the dashboard has a stable slot to render once a real cache layer is
 * introduced, without any other code needing to change.
 */
@Injectable()
export class CacheHealthProvider implements HealthProvider {
  readonly name = "cache";

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () =>
      Promise.resolve({
        name: this.name,
        status: "HEALTHY",
        message: "No external cache layer configured - nothing to check",
        checkedAt: new Date().toISOString(),
      }),
    );
  }
}
