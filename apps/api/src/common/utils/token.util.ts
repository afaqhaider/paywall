import { createHash, randomBytes } from "crypto";

export interface OpaqueToken {
  /** The raw token to hand to the client — never persisted. */
  token: string;
  /** SHA-256 digest of the token — safe to persist and compare against. */
  tokenHash: string;
}

export function generateOpaqueToken(byteLength = 32): OpaqueToken {
  const token = randomBytes(byteLength).toString("hex");
  return { token, tokenHash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
