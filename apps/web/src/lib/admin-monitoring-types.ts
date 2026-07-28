/** Some monitoring sub-fields may not be wired up yet on the API side and are
 * returned as `{ available: false, reason }` instead of real data - render
 * those as a muted "not available" note rather than an error. */
export type MaybeAvailable<T> = T | { available: false; reason?: string };

export function isAvailable<T>(value: MaybeAvailable<T> | undefined | null): value is T {
  if (value === undefined || value === null) return false;
  if (typeof value === "object" && "available" in (value as Record<string, unknown>)) {
    return (value as { available: boolean }).available !== false;
  }
  return true;
}

export interface AdminMonitoringOverview {
  apiRequests?: MaybeAvailable<Record<string, unknown>>;
  webhookDeliveries?: MaybeAvailable<Record<string, unknown>>;
  erpSynchronizations?: MaybeAvailable<Record<string, unknown>>;
  paymentProcessing?: MaybeAvailable<Record<string, unknown>>;
  queueLength?: MaybeAvailable<number | Record<string, unknown>>;
  workerStatus?: MaybeAvailable<Record<string, unknown>>;
  databaseStatus?: MaybeAvailable<Record<string, unknown>>;
  cacheStatus?: MaybeAvailable<Record<string, unknown>>;
  storageUsage?: MaybeAvailable<Record<string, unknown>>;
  backgroundJobs?: MaybeAvailable<Record<string, unknown>>;
}
