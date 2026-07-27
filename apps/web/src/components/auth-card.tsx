import Link from "next/link";
import { PLATFORM_NAME } from "@paywall/shared";
import { Card, CardContent, CardHeader } from "@paywall/ui";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            {PLATFORM_NAME}
          </Link>
        </div>
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
