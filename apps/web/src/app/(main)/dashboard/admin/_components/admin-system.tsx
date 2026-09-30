"use client";
import { Database, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import { AdminAiMetrics } from "./admin-ai-metrics";
import type { SystemState } from "./admin-types";
export function AdminSystem() {
  const resource = useApiResource<SystemState>("/admin/system");
  const data = resource.data;
  if (resource.loading || resource.error || !data) return <ResourceState {...resource} retry={resource.reload} />;
  return (
    <div className="flex flex-col gap-5">
      <AdminAiMetrics />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { name: "PostgreSQL", icon: Database, check: data.database },
          { name: "Redis", icon: Server, check: data.redis },
        ].map(({ name, icon: Icon, check }) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4" />
                {name}
              </CardTitle>
              <CardDescription>Checked {new Date(data.checkedAt).toLocaleTimeString()}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Badge variant={check.status === "healthy" ? "secondary" : "destructive"}>{check.status}</Badge>
              <span className="text-muted-foreground text-sm">
                {check.latencyMs === null ? "No response" : `${check.latencyMs} ms`}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integration capabilities</CardTitle>
          <CardDescription>
            {data.articles === null ? "Article count unavailable" : `${data.articles} sourced articles stored`} ·
            Configuration is separate from external provider availability.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {data.integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="max-w-2xl">
                <p className="font-medium text-sm">{integration.name}</p>
                <p className="mt-1 text-muted-foreground text-sm">{integration.detail}</p>
              </div>
              <Badge variant="outline">{integration.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
