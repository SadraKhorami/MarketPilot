"use client";
import { useEffect } from "react";

import { Database, Newspaper, RefreshCw, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import { AdminAiMetrics } from "./admin-ai-metrics";
import { AdminBots } from "./admin-bots";
import { AdminJobs } from "./admin-jobs";
import type { SystemState } from "./admin-types";

export function AdminSystem() {
  const resource = useApiResource<SystemState>("/admin/system", { keepDataOnReload: true });
  const data = resource.data;
  useEffect(() => {
    const timer = window.setInterval(resource.reload, 30000);
    return () => window.clearInterval(timer);
  }, [resource.reload]);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section aria-labelledby="infrastructure-title" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="infrastructure-title" className="font-semibold text-lg">
              Infrastructure
            </h2>
            <p className="text-muted-foreground text-sm">
              {data
                ? `Checked ${new Date(data.checkedAt).toLocaleTimeString()} · refreshes every 30 seconds`
                : "Database, cache and stored news"}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={resource.loading} onClick={resource.reload}>
            <RefreshCw data-icon="inline-start" /> Refresh
          </Button>
        </div>
        <ResourceState {...resource} retry={resource.reload} />
        {data && !resource.error ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            {[
              {
                name: "PostgreSQL",
                icon: Database,
                check: data.database,
                detail: "Application data and durable alert events",
              },
              { name: "Redis", icon: Server, check: data.redis, detail: "Queues, schedules and cached observations" },
            ].map(({ name, icon: Icon, check, detail }) => (
              <Card key={name} className="min-w-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0" />
                    {name}
                  </CardTitle>
                  <CardAction>
                    <Badge variant={check.status === "healthy" ? "secondary" : "destructive"}>
                      {check.status === "healthy" ? "Healthy" : "Unavailable"}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="font-semibold text-2xl tabular-nums">
                    {check.latencyMs === null ? "—" : check.latencyMs}
                    <span className="ml-1 font-normal text-muted-foreground text-sm">
                      {check.latencyMs === null ? "No response" : "ms latency"}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">{detail}</p>
                </CardContent>
              </Card>
            ))}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="size-4" />
                  News library
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="font-semibold text-2xl tabular-nums">{data.articles?.toLocaleString() ?? "—"}</p>
                <p className="text-muted-foreground text-xs">
                  {data.articles === null
                    ? "Article count unavailable"
                    : "Sourced articles stored for search and research"}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
      <AdminJobs />
      <AdminBots />
      <AdminAiMetrics />
      {data && !resource.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Configured capabilities. These states do not verify external provider availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 md:grid-cols-2">
            {data.integrations.map((integration) => (
              <div key={integration.name} className="flex min-w-0 flex-col gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium text-sm">{integration.name}</p>
                  <Badge className="shrink-0" variant="outline">
                    {integration.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">{integration.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
