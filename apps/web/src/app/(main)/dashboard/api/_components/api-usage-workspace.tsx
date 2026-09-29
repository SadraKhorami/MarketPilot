"use client";

import { useEffect, useState } from "react";

import { ChartColumn, CircleHelp } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { UsageChart } from "./usage-chart";

type UsageData = {
  days: number;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageLatencyMs: number | null;
  byDay: Array<{ day: string; requests: number }>;
  recent: Array<{
    requestId: string;
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    occurredAt: string;
  }>;
};

export function ApiUsageWorkspace() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiRequest<ApiEnvelope<UsageData>>("/api-keys/usage?days=7")
      .then(({ data }) => setUsage(data))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load API usage."))
      .finally(() => setLoading(false));
  }, []);
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const match = usage?.byDay.find((entry) => new Date(entry.day).toDateString() === date.toDateString());
    return { day: date.toLocaleDateString(undefined, { weekday: "short" }), requests: match?.requests ?? 0 };
  });
  const successPercent = usage?.totalRequests ? (usage.successfulRequests / usage.totalRequests) * 100 : 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Requests · 7 days", loading ? "…" : String(usage?.totalRequests ?? 0)],
          ["Success rate", loading ? "…" : `${successPercent.toFixed(1)}%`],
          ["Average latency", loading ? "…" : `${Math.round(usage?.averageLatencyMs ?? 0)} ms`],
          ["Rate limit", "120 / min"],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loading ? "Loading account data" : "Authenticated API activity"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Request volume</CardTitle>
              <CardDescription>Requests recorded during the last seven days</CardDescription>
            </div>
            <ChartColumn className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground" role="status">
                Loading usage…
              </div>
            ) : (
              <UsageChart data={chartData} />
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Usage overview</CardTitle>
            <CardDescription>Authenticated requests by outcome</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Successful requests", successPercent],
              ["Errors", usage?.totalRequests ? (usage.errorRequests / usage.totalRequests) * 100 : 0],
            ].map(([label, percent]) => (
              <div key={String(label)} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{Number(percent).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </div>
            ))}
            <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Requests are recorded without bodies, credentials, or sensitive query values.
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent requests</CardTitle>
          <CardDescription>Most recent authenticated API requests</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground" role="status">
              Loading requests…
            </p>
          ) : !usage?.recent.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No request records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.recent.map((row) => (
                    <TableRow key={row.requestId}>
                      <TableCell>{row.method}</TableCell>
                      <TableCell className="font-mono text-xs">{row.route}</TableCell>
                      <TableCell>{row.statusCode}</TableCell>
                      <TableCell>{row.latencyMs} ms</TableCell>
                      <TableCell>{new Date(row.occurredAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
