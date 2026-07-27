export const ACCESS_TOKEN_TTL = "15m";
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

export const REFRESH_TOKEN_TTL_MS = {
  default: 24 * 60 * 60 * 1000, // 1 day
  rememberMe: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
