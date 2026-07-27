"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert } from "@paywall/ui";
import { AuthCard } from "../../components/auth-card";
import { apiFetch, ApiError } from "../../lib/api-client";

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }

    apiFetch<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setState("success");
        setMessage(res.message);
      })
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Verification failed.");
      });
  }, [token]);

  if (state === "loading") {
    return <Alert>Verifying your email…</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant={state === "success" ? "success" : "destructive"}>{message}</Alert>
      <Link href="/login" className="text-center text-sm text-slate-500 underline">
        Go to login
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Email verification">
      <Suspense fallback={<Alert>Verifying your email…</Alert>}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthCard>
  );
}
