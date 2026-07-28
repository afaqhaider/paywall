export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface DecodedCursor {
  createdAt: Date;
  id: string;
}

/** Opaque cursor encoding `(createdAt, id)` - stable even with duplicate timestamps. */
export function encodeCursor(item: { id: string; createdAt: Date }): string {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): DecodedCursor {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [createdAt, id] = decoded.split("|");
  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
    throw new Error("Invalid pagination cursor");
  }
  return { createdAt: new Date(createdAt), id };
}

export function normalizePageSize(limit?: number): number {
  if (!limit) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
}

/**
 * Builds the Prisma `where` fragment for "everything strictly before this
 * cursor", ordered newest-first by `(createdAt, id)`. Merge the result into
 * a model-specific `where` with `AND`.
 */
export function buildCursorWhereClause(cursor?: string) {
  if (!cursor) return undefined;
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
}

export const CURSOR_ORDER_BY = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/** Slices a `limit + 1`-sized page down to `limit` and computes the next cursor. */
export function paginateResults<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}
