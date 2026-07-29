"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PLATFORM_NAME } from "@paywall/shared";
import { Button, cn } from "@paywall/ui";
import { useAuth } from "../lib/auth-context";

const NAV_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/licenses", label: "Licenses" },
  { href: "/admin/financial-integrations", label: "Financial Integrations" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/erp-status", label: "ERP Status" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/queues", label: "Monitoring" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/automation-rules", label: "Automation Rules" },
  { href: "/admin/workers", label: "Workers" },
  { href: "/admin/job-queues", label: "Queues" },
  { href: "/admin/scheduled-jobs", label: "Scheduled Jobs" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/notification-templates", label: "Notification Templates" },
  { href: "/admin/system-health", label: "System Health" },
  { href: "/admin/audit-center", label: "Audit Center" },
  { href: "/admin/fraud-center", label: "Fraud Center" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/executive-dashboard", label: "Executive Dashboard" },
  { href: "/admin/platform-intelligence", label: "Platform Intelligence" },
  { href: "/admin/report-requests", label: "Report Requests" },
  { href: "/admin/review-reports", label: "Review Reports" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Nav shell for the internal-only Platform Administration & Operations
 * Center (`/admin/**`) - deliberately separate from `DashboardNav`
 * (org staff/developers) and `PortalNav` (customers). Same auth/session
 * (`useAuth`), gated to Super Admins by `AdminGate` in `admin/layout.tsx`.
 */
export function AdminNav({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-slate-200 bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/admin" className="text-base font-semibold tracking-tight text-white">
          {PLATFORM_NAME}
          <span className="ml-2 font-normal text-slate-400">Platform Admin</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn("hover:text-white", active && "font-semibold text-white")}
              >
                {link.label}
              </Link>
            );
          })}
          {children}
          <span className="hidden text-slate-500 sm:inline">{user?.email}</span>
          <Link href="/dashboard" className="hover:text-white">
            Exit
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
