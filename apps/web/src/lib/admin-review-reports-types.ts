/** Review moderation - mirrors `ReviewModerationController`
 * (`admin/review-reports`). */

export const REVIEW_REPORT_STATUSES = ["PENDING", "REVIEWED", "DISMISSED"] as const;
export type ReviewReportStatus = (typeof REVIEW_REPORT_STATUSES)[number];

export interface ReviewReportRecord {
  id: string;
  reviewId: string;
  reportedById: string;
  reason: string;
  status: ReviewReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  review: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    deletedAt: string | null;
    listing: {
      id: string;
      application: { id: string; name: string; slug: string; organizationId: string };
    };
  };
}

export function reviewReportStatusVariant(
  status: ReviewReportStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "REVIEWED":
      return "success";
    case "DISMISSED":
      return "destructive";
    default:
      return "outline";
  }
}
