import { createHmac, randomBytes } from "crypto";

/**
 * Dependency-free RFC 6238 TOTP (and RFC 4226 HOTP core) implementation using
 * only Node's built-in `crypto` module - `otplib`/`speakeasy` are not
 * dependencies of this package and this phase deliberately avoids adding one
 * for ~40 lines of well-documented, standard math.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
/** Tolerate +/- one 30s step of clock drift between client and server. */
const TOTP_WINDOW = 1;

/** RFC 4648 base32 encoding (no padding) - used for the otpauth:// secret param. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue; // ignore stray whitespace/formatting characters
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Generates a new random TOTP secret (raw bytes - base32-encode it for display/otpauth). */
export function generateTotpSecret(byteLength = 20): Buffer {
  return randomBytes(byteLength);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const lastByte = hmac[hmac.length - 1] ?? 0;
  const offset = lastByte & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

export function generateTotp(secret: Buffer, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  return hotp(secret, counter);
}

/** Verifies a 6-digit TOTP code, allowing +/- TOTP_WINDOW steps of clock drift. */
export function verifyTotp(secret: Buffer, code: string, at: Date = new Date()): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return false;
  }

  const counter = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  for (let errorWindow = -TOTP_WINDOW; errorWindow <= TOTP_WINDOW; errorWindow++) {
    if (hotp(secret, counter + errorWindow) === trimmed) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUrl(params: {
  email: string;
  secretBase32: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.email}`);
  const query = new URLSearchParams({ secret: params.secretBase32, issuer: params.issuer });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Generates one human-typeable recovery code, e.g. "A1B2C-D3E4F". */
export function generateRecoveryCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}
