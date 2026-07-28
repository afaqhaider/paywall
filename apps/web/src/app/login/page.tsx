"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@paywall/ui";
import { AuthCard } from "../../components/auth-card";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const { login, verifyTwoFactorLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set once `login()` reports `twoFactorRequired: true` - presence of this
  // token switches the form into the second-step "enter your code" view.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, rememberMe);
      if (result.twoFactorRequired) {
        setChallengeToken(result.challengeToken);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setVerifying(true);
    try {
      await verifyTwoFactorLogin(challengeToken, code);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired code.");
    } finally {
      setVerifying(false);
    }
  }

  if (challengeToken) {
    return (
      <AuthCard
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app"
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-4" noValidate>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div>
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <Button type="submit" disabled={verifying || code.length !== 6} className="w-full">
            {verifying ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            className="text-center text-sm text-slate-500 underline"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setError(null);
            }}
          >
            Back to login
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-slate-500 underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Remember me
        </label>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Logging in..." : "Log in"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-slate-900 underline">
            Register
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
