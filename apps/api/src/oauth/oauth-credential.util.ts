import { randomBytes } from "crypto";
import { encryptSecret, lastFourOf } from "../common/utils/encryption.util";

export interface GeneratedOAuthCredential {
  clientId: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  lastFour: string;
  /** The plaintext client_secret - never persisted, only returned once at creation/rotation time. */
  plainText: string;
}

/**
 * Generates a fresh OAuth client_id/client_secret pair. Unlike API keys /
 * license keys (one-way hashed), the secret must be recoverable for
 * token-exchange comparison, so it is reversibly encrypted with the same
 * AES-256-GCM helper ApplicationSecret uses.
 */
export function generateOAuthCredential(): GeneratedOAuthCredential {
  const clientId = `oauth_client_${randomBytes(12).toString("hex")}`;
  const plainText = randomBytes(32).toString("base64url");
  const { encryptedValue, iv, authTag } = encryptSecret(plainText);

  return {
    clientId,
    encryptedValue,
    iv,
    authTag,
    lastFour: lastFourOf(plainText),
    plainText,
  };
}
