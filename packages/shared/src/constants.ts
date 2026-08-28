export const PLATFORM_NAME = "SSCodeAxis";

export const PLATFORM_VERSION =
  typeof process !== "undefined" && process.env.PLATFORM_VERSION
    ? process.env.PLATFORM_VERSION
    : "0.1.0";
