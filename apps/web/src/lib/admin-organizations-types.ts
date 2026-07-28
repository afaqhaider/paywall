export type AdminOrganizationStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "DELETED";

export interface AdminOrganizationListItem {
  id: string;
  name: string;
  slug: string;
  status: AdminOrganizationStatus;
  memberCount: number;
  applicationCount: number;
}

export interface AdminOrganizationMember {
  id: string;
  userId: string;
  role: string;
  email?: string | null;
  displayName?: string | null;
  joinedAt?: string | null;
}

export interface AdminOrganizationDetail extends AdminOrganizationListItem {
  members: AdminOrganizationMember[];
  financialMode: string | null;
  erpStatus: string | null;
  apiUsageCount: number | null;
  storageUsage: number | string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Badge variant helper - keeps status -> color mapping in one place. Only
 * "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function adminOrganizationStatusVariant(
  status: string,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "outline";
    case "ARCHIVED":
    case "DELETED":
      return "destructive";
    default:
      return "default";
  }
}
