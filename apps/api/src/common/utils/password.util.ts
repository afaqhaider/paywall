import * as bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function isStrongPassword(plainText: string): boolean {
  return STRONG_PASSWORD_REGEX.test(plainText);
}

/**
 * A syntactically valid but unusable bcrypt hash, used to run a dummy
 * comparison when a login's email doesn't match any account — so the
 * response takes the same time either way and can't be used to enumerate
 * registered emails.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.";
