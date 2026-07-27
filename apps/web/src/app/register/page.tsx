"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@paywall/ui";
import { AuthCard } from "../../components/auth-card";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, firstName || undefined, lastName || undefined);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your email" subtitle="We sent you a verification link.">
        <Alert variant="success">
          Registration successful. Verify your email, then{" "}
          <Link href="/login" className="underline">
            log in
          </Link>
          .
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Join the SS Zentronics Platform">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>
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
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="password-help"
          />
          <p id="password-help" className="mt-1 text-xs text-slate-500">
            At least 12 characters, with an uppercase letter, lowercase letter, number, and symbol.
          </p>
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating account..." : "Create account"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
