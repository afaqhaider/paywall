"use client";

import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useCustomer } from "../../../lib/customer-context";

function OrganizationsContent() {
  const { customers, selectedCustomerId, selectCustomer, loading } = useCustomer();

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every organization and application you have a customer relationship with.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : customers.length === 0 ? (
          <Alert className="mt-8">You don&apos;t have any customer accounts yet.</Alert>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {customers.map((c) => (
              <Card
                key={c.customerId}
                className={
                  c.customerId === selectedCustomerId ? "ring-2 ring-slate-900" : undefined
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{c.organizationName}</span>
                    <Badge variant="outline">{c.type.toLowerCase()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-slate-700">
                  <p>
                    Application: <span className="font-medium">{c.applicationName}</span>
                  </p>
                  {c.displayName ? (
                    <p className="text-xs text-slate-500">Account: {c.displayName}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => selectCustomer(c.customerId)}
                    className="mt-2 text-xs font-medium text-slate-900 underline"
                  >
                    {c.customerId === selectedCustomerId
                      ? "Currently active"
                      : "Switch to this account"}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function OrganizationsPage() {
  return (
    <ProtectedRoute>
      <OrganizationsContent />
    </ProtectedRoute>
  );
}
