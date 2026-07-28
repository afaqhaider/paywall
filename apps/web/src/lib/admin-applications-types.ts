import type {
  ApplicationEnvironment,
  ApplicationSecretMetadata,
  ApplicationVersion,
} from "./applications-types";
import type { APIKey } from "./api-keys-types";
import type { WebhookEndpoint } from "./webhooks-types";

/** Wider than the developer-facing `ApplicationStatus` - admin actions can also SUSPEND. */
export type AdminApplicationStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface AdminApplicationListItem {
  id: string;
  name: string;
  slug: string;
  status: AdminApplicationStatus;
  organizationId: string;
  organizationName: string;
  createdAt?: string;
}

export interface AdminApplicationDetail extends AdminApplicationListItem {
  displayName: string | null;
  description: string | null;
  versions: ApplicationVersion[];
  apiKeys: APIKey[];
  environments: ApplicationEnvironment[];
  webhooks: WebhookEndpoint[];
  secrets: ApplicationSecretMetadata[];
}

/** Badge variant helper - keeps status -> color mapping in one place. */
export function adminApplicationStatusVariant(
  status: string,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "outline";
    case "ARCHIVED":
      return "destructive";
    default:
      return "default";
  }
}
