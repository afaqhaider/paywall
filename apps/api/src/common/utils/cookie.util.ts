import type { Response } from "express";
import { randomBytes } from "crypto";
import { CSRF_COOKIE_NAME } from "../guards/csrf.guard";

export const REFRESH_COOKIE_NAME = "refresh_token";

interface CookieOptions {
  maxAgeMs: number;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setRefreshCookies(
  res: Response,
  refreshToken: string,
  { maxAgeMs }: CookieOptions,
): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/auth",
    maxAge: maxAgeMs,
  });

  // Non-httpOnly so client JS can read it and echo it back as a header
  // (double-submit CSRF pattern) for cookie-authenticated endpoints.
  res.cookie(CSRF_COOKIE_NAME, randomBytes(24).toString("hex"), {
    httpOnly: false,
    secure: isProduction(),
    sameSite: "lax",
    path: "/auth",
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/auth" });
}
