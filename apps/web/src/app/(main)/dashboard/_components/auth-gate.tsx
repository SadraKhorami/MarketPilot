"use client";

import { type ReactNode, useEffect, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { type ApiEnvelope, ApiError, apiRequest } from "@/lib/api/client";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ready" | "unavailable">("checking");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    apiRequest<ApiEnvelope<unknown>>("/auth/me")
      .then(() => {
        if (active) setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace(`/auth/v2/login?next=${encodeURIComponent(pathname)}`);
        else setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (state === "checking")
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">
        Checking your session…
      </div>
    );
  if (state === "unavailable")
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border p-6 text-center">
        <h2 className="font-semibold text-lg">MarketPilot API unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The dashboard requires an authenticated API session. Start the API and database, then try again.
        </p>
        <Link className="mt-4 inline-flex text-sm underline" href="/auth/v2/login">
          Return to sign in
        </Link>
      </div>
    );
  return children;
}
