export const NOTIFICATION_CATEGORIES = [
  "WELCOME",
  "PASSWORD_RESET",
  "INVOICE",
  "RECEIPT",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_EXPIRING",
  "TRIAL_ENDING",
  "PAYMENT_FAILED",
  "ERP_SYNC_FAILED",
  "PLATFORM_ANNOUNCEMENT",
  "GENERAL",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ["EMAIL", "PUSH", "IN_APP", "WEBHOOK", "SMS"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationTemplate {
  id: string;
  key: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const NOTIFICATION_DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED", "RETRYING"] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  templateId: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformNotification {
  id: string;
  category: NotificationCategory;
  recipientUserId: string | null;
  organizationId: string | null;
  customerId: string | null;
  payload: Record<string, unknown>;
  correlationId: string | null;
  createdAt: string;
  deliveries: NotificationDelivery[];
}

/** Badge variant helper - only "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function deliveryStatusVariant(
  status: NotificationDeliveryStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SENT":
      return "success";
    case "FAILED":
      return "destructive";
    case "RETRYING":
      return "outline";
    default:
      return "default";
  }
}
