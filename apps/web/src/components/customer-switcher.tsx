"use client";

import type { CustomerRelationship } from "../lib/customer-portal-types";

export function CustomerSwitcher({
  customers,
  selectedCustomerId,
  onSelect,
}: {
  customers: CustomerRelationship[];
  selectedCustomerId: string | null;
  onSelect: (customerId: string) => void;
}) {
  if (customers.length === 0) {
    return <span className="text-sm text-slate-400">No customer accounts yet</span>;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Account</span>
      <select
        value={selectedCustomerId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        aria-label="Switch customer account"
      >
        {customers.map((c) => (
          <option key={c.customerId} value={c.customerId}>
            {c.displayName ?? c.applicationName} · {c.organizationName}
          </option>
        ))}
      </select>
    </label>
  );
}
