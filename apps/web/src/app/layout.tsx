import type { Metadata } from "next";
import { PLATFORM_NAME } from "@paywall/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: "Subscription, licensing and entitlement platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
