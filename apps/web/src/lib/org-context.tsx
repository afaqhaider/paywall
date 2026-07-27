"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

const SELECTED_ORG_KEY = "ssz.selectedOrgId";

interface OrgContextValue {
  organizations: OrgSummary[];
  selectedOrgId: string | null;
  selectedOrg: OrgSummary | null;
  loading: boolean;
  selectOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

/**
 * Centralizes "which organization is the user currently working in" - every
 * App Registry page needs this, so it's fetched and persisted (localStorage,
 * same key the dashboard originally used) once here instead of being
 * duplicated per page.
 */
export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { authedFetch, status } = useAuth();
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await authedFetch<OrgSummary[]>("/organizations");
      setOrganizations(orgs);
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_ORG_KEY) : null;
      const stillValid = stored && orgs.some((o) => o.id === stored);
      setSelectedOrgId(stillValid ? stored : (orgs[0]?.id ?? null));
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (status === "authenticated") {
      void refresh();
    }
  }, [status, refresh]);

  const selectOrg = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_ORG_KEY, orgId);
    }
  }, []);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId],
  );

  const value = useMemo<OrgContextValue>(
    () => ({ organizations, selectedOrgId, selectedOrg, loading, selectOrg, refresh }),
    [organizations, selectedOrgId, selectedOrg, loading, selectOrg, refresh],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
