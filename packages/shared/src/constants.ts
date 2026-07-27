export const PLATFORM_NAME = "SS Zentronics Platform";

export const PLATFORM_VERSION =
  typeof process !== "undefined" && process.env.PLATFORM_VERSION
    ? process.env.PLATFORM_VERSION
    : "0.1.0";
