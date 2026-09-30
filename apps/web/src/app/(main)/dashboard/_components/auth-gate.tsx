"use client";
import { createContext, type ReactNode, useContext, useEffect } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Array<"ADMIN" | "USER">;
}
const SessionContext = createContext<SessionUser | null>(null);
export const useSessionUser = () => useContext(SessionContext);

export function AuthGate({ children }: { children: ReactNode }) {
  const { data: user, loading, error, status, reload } = useApiResource<SessionUser>("/auth/me");
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (status === 401) router.replace("/auth/v2/login");
    const expired = () => router.replace("/auth/v2/login");
    window.addEventListener("marketpilot:session-expired", expired);
    return () => window.removeEventListener("marketpilot:session-expired", expired);
  }, [router, status]);
  // Navigation uses one shared identity. Authorization is enforced on every backend request.
  useEffect(() => {
    if (user && pathname.startsWith("/dashboard/admin") && !user.roles.includes("ADMIN"))
      router.replace("/dashboard/default");
  }, [user, pathname, router]);
  if (error && status !== 401)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Could not check your session</EmptyTitle>
          <EmptyDescription>The service is temporarily unavailable. Try again in a moment.</EmptyDescription>
        </EmptyHeader>
        <Button onClick={reload}>Try again</Button>
      </Empty>
    );
  if (loading || !user)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground text-sm" role="status">
        Checking your session…
      </div>
    );
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
export function AdminGate({ children }: { children: ReactNode }) {
  const user = useSessionUser();
  if (!user?.roles.includes("ADMIN"))
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Administrator access required</EmptyTitle>
        </EmptyHeader>
        <Button asChild variant="outline">
          <Link href="/dashboard/default">Return to dashboard</Link>
        </Button>
      </Empty>
    );
  return children;
}
