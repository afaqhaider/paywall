# Marketplace Storefront

The `/marketplace/**` routes are the **only fully public section** of the SSCodeAxis web app. There is no dashboard/admin/portal chrome here — each page renders its own lightweight `MarketplaceHeader` instead of `AdminNav`/`DashboardNav`, and none of the pages are wrapped in `ProtectedRoute`. Anyone can browse, search, and read reviews without logging in, similar to a public app store.

Regardless of what other visibility levels or statuses exist elsewhere in the platform (`DRAFT`, `PRIVATE`, `INVITE_ONLY`, `INTERNAL`, etc.), **only listings with `status: PUBLISHED` and `visibility: PUBLIC` are ever returned** by the storefront API (`apps/api/src/marketplace/marketplace-store.service.ts`, `PUBLIC_WHERE`). This filter is applied server-side on every query — browse, search, categories, and detail — so a non-public listing simply does not exist as far as these pages are concerned (its detail page 404s, per `NotFoundException("Listing not found or not publicly available")`).

Pages covered: 3.

---

## /marketplace

**Purpose:** Browse/search page for the public application catalogue — the storefront's home page.

**Access requirements:** Fully public, no auth. Logged-in users additionally see their email and a link to `/dashboard` in the header instead of "Log in".

**API calls:**

- `GET /store/categories` — loads the category filter dropdown on mount.
- `GET /store/apps?q=&category=&sort=&cursor=` — loads/reloads the listing grid whenever the query params change (search submit) or "Load more" is clicked (with `cursor` appended for the next page).

**Key UI/behavior:**

- Search box (`q`), category filter (populated from `/store/categories`, each option shows a listing count), and a sort dropdown restricted to `STORE_SORT_VALUES`: `featured`, `recent`, `popular`, `top_rated`, `newest`.
- Filters are reflected into the URL (`router.replace`) so the browse state is shareable/bookmarkable.
- Pagination is cursor-based: the response is `{ data, nextCursor }`; a "Load more" button appends the next page to the existing list rather than replacing it. There's no page-number pagination.
- Each result card shows icon, name, average rating + review count (only for `top_rated` sort, where the API attaches `averageRating`/`reviewCount` per listing), tagline, up to 3 category badges, and install count. Cards link to `/marketplace/[slug-or-id]`.

**Edge cases / notes:**

- `sort=top_rated` is handled specially by the backend (`MarketplaceStoreController.browse`): it calls a separate `topRated()` method that aggregates `Review.rating` via `groupBy` (Prisma can't `orderBy` a relation aggregate directly), then re-fetches only the public listings among those top-rated IDs. This response has `nextCursor: null` — i.e. **no pagination for top-rated results**, capped at the internal `limit` (default 20).
- `featured` and `popular` sort are the same underlying order-by (`installCount desc`, then `publishedAt desc`) — there is no manual editorial "featured" curation flag on `Listing`; "featured" is just a documented heuristic, per a comment in `marketplace-store.service.ts`.
- Empty results render "No applications found." rather than an error.

---

## /marketplace/categories

**Purpose:** Directory of marketplace categories, each showing how many public listings it contains.

**Access requirements:** Fully public, no auth.

**API calls:**

- `GET /store/categories` — the only call this page makes, on mount.

**Key UI/behavior:**

- Renders a grid of category cards (name, optional description, listing count). Clicking a card navigates to `/marketplace?category={slug}`, i.e. this page is purely a browsing entry point into the main browse page's category filter — it does not list listings itself.
- No search/sort/pagination on this page.

**Edge cases / notes:**

- Categories are returned in alphabetical order (`orderBy: { name: "asc" }`) with a `_count.listings` that reflects total listings tagged with that category — this count is not filtered to only public/published listings on the API side, so it may include non-public listings in the tally even though clicking through only shows public ones.

---

## /marketplace/[applicationSlugOrId]

**Purpose:** Detail page for a single application listing — description, media, changelog, ratings, and reviews (read + write).

**Access requirements:** Viewing the listing and reading reviews is fully public. Writing a review requires an authenticated user (`useAuth` status === `"authenticated"`); logged-out visitors instead see a "Log in to write a review" prompt. Beyond authentication, the backend additionally requires the user to be a `Customer` of the listing's application (`ReviewsService.requireCustomer` — throws `ForbiddenException` if the user has no `Customer` record for that `applicationId`), so being logged in alone is not sufficient to submit a review; the write form itself doesn't pre-check this and will surface the resulting API error.

**API calls:**

- `GET /store/apps/:applicationSlugOrId` — listing detail (accepts either the application's slug or id), loaded in parallel with reviews on mount.
- `GET /store/apps/:applicationSlugOrId/reviews` — public list of reviews for the listing.
- `POST /store/apps/:applicationSlugOrId/reviews` — submits a new review (requires auth); on success the page reloads both listing + reviews.

**Key UI/behavior:**

- Header: icon, name, tagline, average rating + review count, install count, category and tag badges.
- Description (preformatted/whitespace-preserving text).
- Media gallery: horizontally scrollable; `SCREENSHOT`/`ICON` media render as images, `VIDEO` media render as an external link (opens in a new tab) rather than an inline player.
- Changelog: version + publish date + notes, most recent first.
- Reviews section: write-review form (rating select 1–5, optional title up to 150 chars, optional body up to 4000 chars) shown only when authenticated; review list shows reviewer display name (or "Anonymous"), star rating, title, body, date, and a developer reply block if one exists.
- Rating aggregate (`averageRating`, `reviewCount`) is computed server-side via `Review.aggregate` over non-deleted reviews for that listing, not client-side from the fetched review list.

**Edge cases / notes:**

- Lookup by `applicationSlugOrId` matches either the application's `id` or `slug` (`OR: [{ id }, { slug }]`) — same dual-lookup pattern used by the marketplace grid's links.
- A listing that exists but isn't `PUBLISHED` + `PUBLIC` renders as a generic load error (the page's `catch` block shows "Could not load this application."), since the API returns 404 for it, indistinguishable from a listing that doesn't exist at all.
- Submitting a review when the user is authenticated but not a customer of the app fails with a 403 from the backend (`ForbiddenException`), which the form surfaces via its inline error alert — the UI does not proactively hide/disable the form for non-customers.
- A user can only review a given listing once; a second submission attempt is rejected with a `ConflictException` ("You have already reviewed this application - edit your existing review instead"). This page has no edit-existing-review UI, however — editing/deleting reviews (`PATCH`/`DELETE /reviews/:reviewId`) and reporting reviews (`POST /reviews/:reviewId/report`) are not exposed on this page at all.
