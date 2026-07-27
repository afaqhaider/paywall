import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, lastFourOf } from "./encryption.util";

describe("encryption.util", () => {
  beforeEach(() => {
    process.env.APP_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips a plaintext value through encrypt/decrypt", () => {
    const payload = encryptSecret("sk_live_super_secret_value");

    expect(payload.encryptedValue).not.toContain("sk_live");
    expect(decryptSecret(payload)).toBe("sk_live_super_secret_value");
  });

  it("uses a random iv, so the same plaintext never produces the same ciphertext twice", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");

    expect(a.iv).not.toBe(b.iv);
    expect(a.encryptedValue).not.toBe(b.encryptedValue);
  });

  it("throws when the auth tag has been tampered with", () => {
    const payload = encryptSecret("tamper-test");
    const tampered = { ...payload, authTag: encryptSecret("different-value").authTag };

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the key is not configured", () => {
    delete process.env.APP_SECRET_ENCRYPTION_KEY;

    expect(() => encryptSecret("anything")).toThrow("APP_SECRET_ENCRYPTION_KEY is not set");
  });

  it("throws when the key does not decode to 32 bytes", () => {
    process.env.APP_SECRET_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");

    expect(() => encryptSecret("anything")).toThrow(/32 bytes/);
  });

  it("lastFourOf returns the final 4 characters", () => {
    expect(lastFourOf("sk_live_abcd1234")).toBe("1234");
  });
});
