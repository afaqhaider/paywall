import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format";

describe("formatTimestamp", () => {
  it("returns an ISO 8601 string", () => {
    const result = formatTimestamp(new Date("2026-01-01T00:00:00.000Z"));
    expect(result).toBe("2026-01-01T00:00:00.000Z");
  });
});
