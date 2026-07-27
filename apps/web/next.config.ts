import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@paywall/ui", "@paywall/shared", "@paywall/types"],
  reactStrictMode: true,
};

export default nextConfig;
