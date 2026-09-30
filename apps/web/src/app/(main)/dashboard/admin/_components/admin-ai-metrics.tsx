"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";

interface AiMetrics {
  days: number;
  statuses: Array<{ status: string; count: number }>;
  _sum: {
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    reservedUsd: number | null;
    toolCount: number | null;
  };
  _avg: { latencyMs: number | null };
}
export function AdminAiMetrics() {
  const resource = useApiResource<AiMetrics>("/ai/metrics");
  const data = resource.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI research operations</CardTitle>
        <CardDescription>
          Last seven days · browser research runs · separate from developer API-key Usage
        </CardDescription>
      </CardHeader>
      <CardContent>
        {resource.loading || resource.error || !data ? (
          <ResourceState {...resource} retry={resource.reload} />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  name: "Research runs",
                  value: data.statuses.reduce((total, item) => total + item.count, 0).toLocaleString(),
                },
                { name: "Application lookups", value: (data._sum.toolCount ?? 0).toLocaleString() },
                {
                  name: "Reported provider cost",
                  value: data._sum.costUsd === null ? "Not reported" : `$${data._sum.costUsd.toFixed(4)}`,
                },
                { name: "Reserved budget", value: `$${(data._sum.reservedUsd ?? 0).toFixed(4)}` },
              ].map((metric) => (
                <div key={metric.name}>
                  <dt className="text-muted-foreground text-xs">{metric.name}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-xs">
              {data.statuses.length
                ? data.statuses.map((item) => `${item.count} ${item.status}`).join(" · ")
                : "No research requests recorded."}{" "}
              · {(data._sum.inputTokens ?? 0).toLocaleString()} input / {(data._sum.outputTokens ?? 0).toLocaleString()}{" "}
              output tokens
              {data._avg.latencyMs === null ? "" : ` · average ${(data._avg.latencyMs / 1000).toFixed(1)} seconds`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
