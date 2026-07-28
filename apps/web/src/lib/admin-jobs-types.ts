export const JOB_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "PROCESSING",
  "SUCCESS",
  "RETRYING",
  "FAILED",
  "DEAD_LETTER",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface BackgroundJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  queueName: string;
  runAt: string | null;
  cron: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  error: string | null;
  correlationId: string | null;
  sourceEventId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface JobHistoryEntry {
  id: string;
  attemptNumber: number;
  status: JobStatus;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface BackgroundJobDetail extends BackgroundJob {
  history: JobHistoryEntry[];
}

export interface QueueSummary {
  queueName: string;
  paused: boolean;
  counts: Partial<Record<JobStatus, number>>;
}

/** Badge variant helper - only "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function jobStatusVariant(
  status: JobStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "FAILED":
    case "DEAD_LETTER":
    case "CANCELLED":
      return "destructive";
    case "PROCESSING":
    case "RETRYING":
      return "outline";
    default:
      return "default";
  }
}
