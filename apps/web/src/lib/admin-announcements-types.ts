export type AnnouncementType = "INFO" | "WARNING" | "MAINTENANCE" | "FEATURE";

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = ["INFO", "WARNING", "MAINTENANCE", "FEATURE"];
