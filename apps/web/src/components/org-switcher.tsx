"use client";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function OrgSwitcher({
  organizations,
  selectedOrgId,
  onSelect,
}: {
  organizations: OrgSummary[];
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
}) {
  if (organizations.length === 0) {
    return <span className="text-sm text-slate-400">No organizations yet</span>;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Organization</span>
      <select
        value={selectedOrgId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        aria-label="Switch organization"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} ({org.role.toLowerCase()})
          </option>
        ))}
      </select>
    </label>
  );
}
