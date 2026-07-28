export type WebhookEndpointStatus = "ENABLED" | "DISABLED";
export type WebhookDeliveryStatus = "PENDING" | "SUCCESS" | "FAILED" | "RETRYING" | "EXHAUSTED";

export interface WebhookSecretMetadata {
  lastFour: string;
  isActive: boolean;
  createdAt: string;
  rotatedAt: string | null;
}

export interface WebhookEndpoint {
  id: string;
  applicationId: string;
  environmentId: string | null;
  url: string;
  description: string | null;
  eventTypes: string[];
  status: WebhookEndpointStatus;
  createdAt: string;
  secret: WebhookSecretMetadata | { id: string; lastFour: string; plainText: string };
}

export interface CreatedWebhookSecret {
  id: string;
  lastFour: string;
  plainText: string;
  createdAt: string;
}

export interface WebhookDeliverySummary {
  id: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  responseStatus: number | null;
  attemptCount: number;
  createdAt: string;
  deliveredAt: string | null;
}

export interface WebhookRetry {
  id: string;
  attemptNumber: number;
  responseStatus: number | null;
  error: string | null;
  executedAt: string;
}

export interface WebhookDeliveryDetail extends WebhookDeliverySummary {
  payload: Record<string, unknown>;
  responseBody: string | null;
  retries: WebhookRetry[];
}

export const WEBHOOK_EVENT_TYPES = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "customer.created",
  "license.issued",
  "license.revoked",
  "entitlement.granted",
  "entitlement.revoked",
  "payment.succeeded",
  "payment.failed",
] as const;
