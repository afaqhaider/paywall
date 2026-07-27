import type { Metadata } from "next";
import { PLATFORM_NAME } from "@paywall/shared";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: "Identity & authentication platform for the SS Zentronics ecosystem.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
