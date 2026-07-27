import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isStrongPassword,
  verifyPassword,
} from "./password.util";

describe("password.util", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("SuperSecret123!");
    await expect(verifyPassword("SuperSecret123!", hash)).resolves.toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("SuperSecret123!");
    await expect(verifyPassword("WrongPassword123!", hash)).resolves.toBe(false);
  });

  it("never matches the dummy hash used for timing-safe login failures", async () => {
    await expect(verifyPassword("anything", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });

  describe("isStrongPassword", () => {
    it.each([
      ["Sh0rt!", false], // too short
      ["alllowercase123!", false], // no uppercase
      ["ALLUPPERCASE123!", false], // no lowercase
      ["NoNumbersHere!!", false], // no number
      ["NoSymbolsHere123", false], // no symbol
      ["ValidPassw0rd!", true],
    ])("%s -> %s", (candidate, expected) => {
      expect(isStrongPassword(candidate)).toBe(expected);
    });
  });
});
