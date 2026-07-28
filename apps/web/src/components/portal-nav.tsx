"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PLATFORM_NAME } from "@paywall/shared";
import { Button, cn } from "@paywall/ui";
import { useAuth } from "../lib/auth-context";

const NAV_LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/subscriptions", label: "Subscriptions" },
  { href: "/portal/licenses", label: "Licenses" },
  { href: "/portal/organizations", label: "Organizations" },
  { href: "/portal/devices", label: "Devices" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/receipts", label: "Receipts" },
  { href: "/portal/transactions", label: "Transactions" },
  { href: "/portal/usage", label: "Usage" },
  { href: "/portal/notifications", label: "Notifications" },
  { href: "/portal/security", label: "Security" },
  { href: "/portal/settings", label: "Settings" },
];

/**
 * Nav shell for the end-user-facing Customer Portal (`/portal/**`) -
 * deliberately separate from `DashboardNav`, which is for organization
 * staff/developers using the App Registry. Same auth/session (`useAuth`),
 * different audience and different link set.
 */
export function PortalNav({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/portal" className="text-base font-semibold tracking-tight text-slate-900">
          {PLATFORM_NAME}
          <span className="ml-2 font-normal text-slate-400">Customer Portal</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn("hover:text-slate-900", active && "font-semibold text-slate-900")}
              >
                {link.label}
              </Link>
            );
          })}
          {children}
          <span className="hidden text-slate-400 sm:inline">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
