"use client";
import { useEffect, useState } from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";
import { AdminBotDeliveries } from "./admin-bot-deliveries";

interface BotOverview {
  checkedAt: string;
  workers: { commands: number; alerts: number } | null;
  providers: Array<{
    provider: string;
    configured: boolean;
    missing: string[];
    invalid: string[];
    runtime: {
      inboundAt: string | null;
      checkedAt: string | null;
      successfulAt: string | null;
      failureCode: string | null;
    } | null;
  }>;
}
export function AdminBots() {
  const resource = useApiResource<BotOverview>("/admin/bots", { keepDataOnReload: true });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(resource.reload, 30000);
    return () => window.clearInterval(timer);
  }, [resource.reload]);
  async function check(provider: string) {
    setBusy(provider);
    try {
      await apiRequest(`/admin/bots/${provider.toLowerCase()}/check`, { method: "POST" });
      resource.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check connectivity.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Bot operations">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Bot runtime</CardTitle>
          <CardDescription>
            Configuration, worker readiness and observed platform responses are separate states.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          <ResourceState {...resource} retry={resource.reload} />
          {resource.data && !resource.error ? (
            <>
              <p className="text-muted-foreground text-sm">
                Command workers: {resource.data.workers?.commands ?? "Unavailable"} · Alert workers:{" "}
                {resource.data.workers?.alerts ?? "Unavailable"} · Heartbeats within 45 seconds
              </p>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                {resource.data.providers.map((provider) => (
                  <div key={provider.provider} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{provider.provider}</p>
                        <Badge className="mt-1" variant="outline">
                          {provider.configured ? "Configured" : "Setup required"}
                        </Badge>
                      </div>
                      <Button
                        className="shrink-0"
                        size="sm"
                        variant="outline"
                        disabled={!provider.configured || busy !== null}
                        onClick={() => void check(provider.provider)}
                      >
                        Check connectivity
                      </Button>
                    </div>
                    {!provider.configured ? (
                      <p className="break-words text-muted-foreground text-sm">
                        Set server configuration: {[...provider.missing, ...provider.invalid].join(", ")}. Register the
                        webhook using the documented bot setup command.
                      </p>
                    ) : null}
                    <dl className="flex flex-col gap-2 text-sm">
                      {[
                        ["Last authenticated event", provider.runtime?.inboundAt],
                        ["Last provider check / send", provider.runtime?.checkedAt],
                        ["Last successful response", provider.runtime?.successfulAt],
                      ].map(([label, value]) => (
                        <div key={label} className="flex flex-wrap justify-between gap-2">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>{value ? new Date(value).toLocaleString() : "Not observed"}</dd>
                        </div>
                      ))}
                    </dl>
                    {provider.runtime?.failureCode ? (
                      <p className="break-words text-destructive text-sm">
                        {provider.runtime.failureCode.replaceAll("_", " ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
      <AdminBotDeliveries />
    </section>
  );
}
