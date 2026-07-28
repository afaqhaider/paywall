/** Marketplace review types - mirrors `ReviewsController`. Reads are public
 * (`GET /store/apps/:applicationSlugOrId/reviews`); writes require an
 * authenticated customer of the listing's application. */

export interface ReviewReply {
  id: string;
  reviewId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  listingId: string;
  customerId: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  reply: ReviewReply | null;
  customer: { displayName: string | null };
}

export interface CreateReviewInput {
  rating: number;
  title?: string;
  body?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  body?: string;
}

export interface ReviewReportInput {
  reason: string;
}
