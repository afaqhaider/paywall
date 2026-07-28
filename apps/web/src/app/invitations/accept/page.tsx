"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { PLATFORM_NAME } from "@paywall/shared";
import { ProtectedRoute } from "../../../components/protected-route";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { AcceptedInvitationMember } from "../../../lib/invitations-types";

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const { authedFetch, user } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedInvitationMember | null>(null);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const member = await authedFetch<AcceptedInvitationMember>(
        `/invitations/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );
      setAccepted(member);
      setTimeout(() => {
        router.push(
          member.applicationId
            ? `/dashboard/apps/${member.applicationId}/members`
            : "/dashboard/apps",
        );
      }, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invitation.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">{PLATFORM_NAME}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Team invitation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!token ? (
            <Alert variant="destructive">
              This link is missing an invitation token. Ask whoever invited you to resend it.
            </Alert>
          ) : accepted ? (
            <Alert variant="success">
              Invitation accepted as <span className="font-medium">{accepted.role}</span> for{" "}
              {user?.email}. Redirecting…
            </Alert>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                You&apos;ve been invited to join an application&apos;s team on {PLATFORM_NAME}.
                Accept below to join as {user?.email}.
              </p>
              {error ? <Alert variant="destructive">{error}</Alert> : null}
              <Button onClick={() => void handleAccept()} disabled={accepting}>
                {accepting ? "Accepting..." : "Accept invitation"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
            Loading…
          </div>
        }
      >
        <AcceptInvitationContent />
      </Suspense>
    </ProtectedRoute>
  );
}
