export const HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "DOWN"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthOverview {
  overall: HealthStatus;
  providers: HealthCheckResult[];
}

/** Badge variant helper - only "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function healthStatusVariant(
  status: HealthStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "HEALTHY":
      return "success";
    case "DOWN":
      return "destructive";
    default:
      return "outline";
  }
}
