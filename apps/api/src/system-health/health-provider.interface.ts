export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

/**
 * One dependency's health check. New providers register themselves as a
 * DI multi-provider (see `SYSTEM_HEALTH_PROVIDERS` in system-health.module.ts,
 * mirroring the exact pattern `PAYMENT_PROVIDER_ADAPTERS` already uses for
 * payment adapters) - `SystemHealthService` and the dashboard never change
 * to support a new provider, they just iterate whatever is registered.
 */
export interface HealthProvider {
  readonly name: string;
  check(): Promise<HealthCheckResult>;
}

const CHECK_TIMEOUT_MS = 5_000;

/**
 * Wraps a provider's own check logic so one slow/hanging dependency can
 * never block the aggregate health response - times out into a DOWN result
 * instead.
 */
export async function withTimeout(
  name: string,
  fn: () => Promise<HealthCheckResult>,
): Promise<HealthCheckResult> {
  return Promise.race([
    fn(),
    new Promise<HealthCheckResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            name,
            status: "DOWN",
            message: "Health check timed out",
            checkedAt: new Date().toISOString(),
          }),
        CHECK_TIMEOUT_MS,
      ),
    ),
  ]);
}
