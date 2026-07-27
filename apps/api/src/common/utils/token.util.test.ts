import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashOpaqueToken } from "./token.util";

describe("token.util", () => {
  it("generates a token whose hash matches hashOpaqueToken", () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(token).toHaveLength(64);
    expect(hashOpaqueToken(token)).toBe(tokenHash);
  });

  it("produces different tokens on each call", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("hashing is deterministic", () => {
    expect(hashOpaqueToken("fixed-value")).toBe(hashOpaqueToken("fixed-value"));
  });
});
