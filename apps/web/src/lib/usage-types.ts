export interface UsageRecord {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  featureId: string;
  quantity: number;
  occurredAt: string;
  idempotencyKey: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
