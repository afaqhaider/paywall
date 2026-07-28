"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";
import type { CustomerRelationship } from "./customer-portal-types";

const SELECTED_CUSTOMER_KEY = "ssz.selectedCustomerId";

interface CustomerContextValue {
  customers: CustomerRelationship[];
  selectedCustomerId: string | null;
  selectedCustomer: CustomerRelationship | null;
  loading: boolean;
  selectCustomer: (customerId: string) => void;
  refresh: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined);

/**
 * Customer Portal equivalent of `org-context.tsx` - centralizes "which
 * customer relationship is the logged-in user currently acting as" (a person
 * can be a customer of more than one org/app), persisted the same way
 * (localStorage) and fetched once here instead of duplicated per page.
 */
export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const { authedFetch, status } = useAuth();
  const [customers, setCustomers] = useState<CustomerRelationship[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await authedFetch<CustomerRelationship[]>("/customer-portal/me/customers");
      setCustomers(list);
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_CUSTOMER_KEY) : null;
      const stillValid = stored && list.some((c) => c.customerId === stored);
      setSelectedCustomerId(stillValid ? stored : (list[0]?.customerId ?? null));
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (status === "authenticated") {
      void refresh();
    }
  }, [status, refresh]);

  const selectCustomer = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_CUSTOMER_KEY, customerId);
    }
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customerId === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const value = useMemo<CustomerContextValue>(
    () => ({ customers, selectedCustomerId, selectedCustomer, loading, selectCustomer, refresh }),
    [customers, selectedCustomerId, selectedCustomer, loading, selectCustomer, refresh],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return context;
}
