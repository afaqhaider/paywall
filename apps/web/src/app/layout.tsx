import type { Metadata } from "next";
import { PLATFORM_NAME } from "@paywall/shared";
import { AuthProvider } from "../lib/auth-context";
import { OrgProvider } from "../lib/org-context";
import "./globals.css";

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: "Identity, organization & application registry platform for SSCodeAxis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <OrgProvider>{children}</OrgProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
