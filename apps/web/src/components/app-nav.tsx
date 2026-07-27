"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@paywall/ui";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/settings", label: "Settings" },
  { href: "/members", label: "Members" },
  { href: "/versions", label: "Versions" },
  { href: "/domains", label: "Domains" },
  { href: "/secrets", label: "Secrets" },
  { href: "/environments", label: "Environments" },
];

export function AppNav({ applicationId }: { applicationId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/apps/${applicationId}`;

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
