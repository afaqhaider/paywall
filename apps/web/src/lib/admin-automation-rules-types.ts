import type { PlatformEventType } from "./admin-events-types";

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerEventType: PlatformEventType;
  enabled: boolean;
  actions: Record<string, unknown>[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const AUTOMATION_RULE_EXECUTION_STATUSES = ["SUCCEEDED", "FAILED", "PARTIAL"] as const;
export type AutomationRuleExecutionStatus = (typeof AUTOMATION_RULE_EXECUTION_STATUSES)[number];

export interface AutomationRuleExecution {
  id: string;
  ruleId: string;
  eventId: string;
  status: AutomationRuleExecutionStatus;
  actionsRun: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

/** Badge variant helper - only "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function ruleExecutionStatusVariant(
  status: AutomationRuleExecutionStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}
