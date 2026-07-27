"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@paywall/ui";
import { AuthCard } from "../../components/auth-card";
import { apiFetch, ApiError } from "../../lib/api-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <Alert variant="destructive">Missing reset token. Use the link from your email.</Alert>;
  }

  if (done) {
    return <Alert variant="success">Password reset. Redirecting to login…</Alert>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          required
          minLength={12}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Resetting..." : "Reset password"}
      </Button>
      <Link href="/login" className="text-center text-sm text-slate-500 underline">
        Back to login
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
