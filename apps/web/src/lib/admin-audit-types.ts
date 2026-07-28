export interface AdminAuditLogEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  actorEmail?: string | null;
  organizationId: string | null;
  applicationId: string | null;
  userId: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditLogFilters {
  organizationId?: string;
  applicationId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}
