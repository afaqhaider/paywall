import { randomBytes } from "crypto";
import { hashOpaqueToken } from "./token.util";

const KEY_BYTES = 24;

export interface GeneratedApiKey {
  /** Full plaintext key, shown to the caller exactly once - never persisted. */
  plainText: string;
  keyPrefix: string;
  keyHash: string;
  lastFour: string;
}

/**
 * Generates an API key in the `sszk_<env>_<random>` shape (env is "live" or
 * "test"). Only `keyHash` (SHA-256, via the same hashOpaqueToken already
 * used for refresh/verification/reset tokens) is ever persisted - the
 * plaintext is unrecoverable after this call returns.
 */
export function generateApiKey(env: "live" | "test" = "live"): GeneratedApiKey {
  const random = randomBytes(KEY_BYTES).toString("base64url");
  const plainText = `sszk_${env}_${random}`;

  return {
    plainText,
    keyPrefix: plainText.slice(0, 12),
    keyHash: hashOpaqueToken(plainText),
    lastFour: plainText.slice(-4),
  };
}
