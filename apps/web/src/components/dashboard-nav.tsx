"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLATFORM_NAME } from "@paywall/shared";
import { Button } from "@paywall/ui";
import { useAuth } from "../lib/auth-context";

export function DashboardNav({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight text-slate-900">
          {PLATFORM_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/dashboard/apps" className="hover:text-slate-900">
            Applications
          </Link>
          <Link href="/dashboard/products" className="hover:text-slate-900">
            Products
          </Link>
          <Link href="/dashboard/customers" className="hover:text-slate-900">
            Customers
          </Link>
          <Link href="/dashboard/subscriptions" className="hover:text-slate-900">
            Subscriptions
          </Link>
          <Link href="/dashboard/coupons" className="hover:text-slate-900">
            Coupons
          </Link>
          <Link href="/dashboard/entitlements" className="hover:text-slate-900">
            Entitlements
          </Link>
          <Link href="/dashboard/licenses" className="hover:text-slate-900">
            Licenses
          </Link>
          <Link href="/dashboard/api-keys" className="hover:text-slate-900">
            API Keys
          </Link>
          <Link href="/dashboard/usage" className="hover:text-slate-900">
            Usage
          </Link>
          <Link href="/dashboard/devices" className="hover:text-slate-900">
            Devices
          </Link>
          <Link href="/dashboard/webhooks" className="hover:text-slate-900">
            Webhooks
          </Link>
          <Link href="/dashboard/oauth" className="hover:text-slate-900">
            OAuth
          </Link>
          <Link href="/dashboard/analytics" className="hover:text-slate-900">
            Analytics
          </Link>
          <Link href="/dashboard/analytics-org" className="hover:text-slate-900">
            Developer Analytics
          </Link>
          <Link href="/dashboard/api-docs" className="hover:text-slate-900">
            API Docs
          </Link>
          <Link href="/dashboard/payment-providers" className="hover:text-slate-900">
            Payment Providers
          </Link>
          <Link href="/dashboard/transactions" className="hover:text-slate-900">
            Transactions
          </Link>
          <Link href="/dashboard/refunds" className="hover:text-slate-900">
            Refunds
          </Link>
          <Link href="/dashboard/invoices" className="hover:text-slate-900">
            Invoices
          </Link>
          <Link href="/dashboard/disputes" className="hover:text-slate-900">
            Disputes
          </Link>
          <Link href="/dashboard/checkout-sessions" className="hover:text-slate-900">
            Checkout Sessions
          </Link>
          <Link href="/dashboard/payment-webhooks" className="hover:text-slate-900">
            Webhooks
          </Link>
          <Link href="/dashboard/payment-methods" className="hover:text-slate-900">
            Payment Methods
          </Link>
          <Link href="/dashboard/white-label" className="hover:text-slate-900">
            White-label
          </Link>
          <Link href="/dashboard/profile" className="hover:text-slate-900">
            Profile
          </Link>
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
