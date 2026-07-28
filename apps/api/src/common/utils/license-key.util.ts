import { randomBytes } from "crypto";
import { hashOpaqueToken } from "./token.util";

// Excludes visually ambiguous characters (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP_COUNT = 5;
const GROUP_LENGTH = 4;

export interface GeneratedLicenseKey {
  /** Full plaintext key, shown to the caller exactly once - never persisted. */
  plainText: string;
  /** Masked hint for admin/support UIs, e.g. "SSZP-****-****-****-9F2A". */
  displayCode: string;
  keyHash: string;
}

function randomGroup(): string {
  const bytes = randomBytes(GROUP_LENGTH);
  let group = "";
  for (const byte of bytes) {
    group += ALPHABET[byte % ALPHABET.length];
  }
  return group;
}

/**
 * Generates a human-readable, offline-activatable license key in the
 * "SSZP-XXXX-XXXX-XXXX-XXXX" shape. Only `keyHash` (SHA-256) is ever
 * persisted, the same one-way-hash pattern used for API keys and auth
 * tokens elsewhere in this codebase - the plaintext is unrecoverable
 * after this call returns, so it must be shown to the caller immediately.
 */
export function generateLicenseKey(): GeneratedLicenseKey {
  const groups = Array.from({ length: GROUP_COUNT }, () => randomGroup());
  const plainText = `SSZP-${groups.join("-")}`;
  const maskedGroups = groups.map((g, i) => (i === groups.length - 1 ? g : "****"));

  return {
    plainText,
    displayCode: `SSZP-${maskedGroups.join("-")}`,
    keyHash: hashOpaqueToken(plainText),
  };
}
