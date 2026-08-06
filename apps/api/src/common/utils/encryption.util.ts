import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { secrets } from "../../config/secrets";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

export interface EncryptedPayload {
  /** Base64-encoded AES-256-GCM ciphertext. */
  encryptedValue: string;
  /** Base64-encoded nonce used for this ciphertext. */
  iv: string;
  /** Base64-encoded GCM authentication tag - detects tampering on decrypt. */
  authTag: string;
}

function loadKey(): Buffer {
  const raw = secrets.appSecretEncryptionKey;
  if (!raw) {
    throw new Error("APP_SECRET_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `APP_SECRET_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes (base64-encoded); got ${key.length}`,
    );
  }

  return key;
}

export function encryptSecret(plainText: string): EncryptedPayload {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const key = loadKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/** A display-safe hint (e.g. "...ab12") - never enough to reconstruct the secret. */
export function lastFourOf(plainText: string): string {
  return plainText.slice(-4);
}
