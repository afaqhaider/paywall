export type ServiceStatus = "up" | "down";

export interface HealthStatus {
  status: "ok" | "error";
  database: ServiceStatus;
  version: string;
  environment: string;
  timestamp: string;
}
