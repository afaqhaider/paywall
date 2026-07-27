"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@paywall/ui";
import { AuthCard } from "../../components/auth-card";
import { apiFetch } from "../../lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your email">
        <Alert>If an account exists for that email, a reset link has been sent.</Alert>
        <Link href="/login" className="text-center text-sm text-slate-500 underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" subtitle="We'll send you a link to reset it">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending..." : "Send reset link"}
        </Button>
        <Link href="/login" className="text-center text-sm text-slate-500 underline">
          Back to login
        </Link>
      </form>
    </AuthCard>
  );
}
