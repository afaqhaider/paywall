"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../../components/protected-route";
import { AdminNav } from "../../components/admin-nav";
import { useAuth } from "../../lib/auth-context";
import { ApiError } from "../../lib/api-client";

/**
 * Client-side gate for the internal-only Platform Admin surface. The API is
 * the source of truth (every `/admin/*` route 403s for non-admins) - this is
 * just a lightweight UX check so a non-admin doesn't sit on a page full of
 * failed requests. It calls `GET /admin/platform-admins/me`; if that route
 * isn't available yet (404) it falls back to a defensive secondary check
 * against `GET /admin/organizations` (200 => admin, 403 => not an admin).
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { authedFetch, status } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function check() {
      try {
        await authedFetch("/admin/platform-admins/me");
        if (!cancelled) {
          setIsAdmin(true);
          setChecking(false);
        }
        return;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          try {
            await authedFetch("/admin/organizations?limit=1");
            if (!cancelled) {
              setIsAdmin(true);
              setChecking(false);
            }
            return;
          } catch {
            // falls through to "not an admin" below
          }
        }
      }
      if (!cancelled) {
        setIsAdmin(false);
        setChecking(false);
        router.replace("/dashboard");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [status, authedFetch, router]);

  if (status !== "authenticated" || checking || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  );
}
