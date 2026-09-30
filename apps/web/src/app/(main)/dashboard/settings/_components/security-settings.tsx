"use client";
import { useState } from "react";

import { Monitor, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";

interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
}
export function SecuritySettings() {
  const resource = useApiResource<Session[]>("/auth/sessions");
  const [revoking, setRevoking] = useState<string | null>(null);
  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await apiRequest(`/auth/sessions/${id}`, { method: "DELETE" });
      resource.reload();
      toast.success("Session signed out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out session.");
    } finally {
      setRevoking(null);
    }
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Signed-in sessions</CardTitle>
          <CardDescription>Review active sessions and sign out other browsers.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResourceState {...resource} retry={resource.reload} />
          {!resource.loading && !resource.error && (
            <div className="flex flex-col divide-y">
              {resource.data?.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Monitor className="size-4" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-sm">
                        {session.current ? "This browser" : "Other browser session"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Signed in {new Date(session.createdAt).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Expires {new Date(session.expiresAt).toLocaleString()}
                      </p>
                      {session.lastSeenAt && (
                        <p className="text-muted-foreground text-xs">
                          Last active {new Date(session.lastSeenAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {session.current ? (
                    <Badge variant="secondary">Current session</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!revoking} onClick={() => void revoke(session.id)}>
                      {revoking === session.id ? "Signing out…" : "Sign out"}
                    </Button>
                  )}
                </div>
              ))}
              {resource.data?.length === 0 && <p className="text-muted-foreground text-sm">No active sessions.</p>}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Account protection
          </CardTitle>
          <CardDescription>Password sign-in and server-managed sessions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span>Session lifetime</span>
            <Badge variant="outline">14 days</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Signing out revokes the current session immediately. Other sessions remain active until you sign them out or
            they expire.
          </p>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">
            Password changes and two-factor authentication are not available yet.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
