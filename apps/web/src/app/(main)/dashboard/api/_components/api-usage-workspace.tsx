"use client";

import { useEffect, useState } from "react";

import { ChartColumn, CircleHelp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
type ApiHealth = { status: string; timestamp: string };

export function ApiUsageWorkspace() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  useEffect(() => {
    apiRequest<ApiEnvelope<UsageData>>("/api-keys/usage?days=7")
      .then(({ data }) => setUsage(data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load API usage."))
      .finally(() => setLoading(false));
    apiRequest<ApiEnvelope<ApiHealth>>("/health/ready")
      .then(({ data }) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const match = usage?.byDay.find((entry) => new Date(entry.day).toDateString() === date.toDateString());
    return { day: date.toLocaleDateString(undefined, { weekday: "short" }), requests: match?.requests ?? 0 };
  });
  const successPercent = usage?.totalRequests ? (usage.successfulRequests / usage.totalRequests) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Requests · 7 days", loading ? "…" : usage ? String(usage.totalRequests) : "Unavailable"],
          ["Success rate", loading ? "…" : successPercent === null ? "—" : `${successPercent.toFixed(1)}%`],
          [
            "Average latency",
            loading
              ? "…"
              : usage?.averageLatencyMs === null || !usage
                ? "—"
                : `${Math.round(usage.averageLatencyMs)} ms`,
          ],
          ["Rate limit", "120 / min"],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-xl tabular-nums">{value}</p>
              <p className="mt-1 text-muted-foreground text-xs">
                {loading ? "Loading account data" : usage ? "Authenticated API activity" : "Request data unavailable"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-muted-foreground text-xs" aria-live="polite">
        <span>MarketPilot API</span>
        <Badge variant={health?.status === "ready" ? "secondary" : "outline"}>
          {health?.status === "ready" ? "Available" : loading ? "Checking" : "Unavailable"}
        </Badge>
        {health ? <span>Checked {new Date(health.timestamp).toLocaleTimeString()}</span> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Request volume</CardTitle>
              <CardDescription>Requests recorded during the last seven days</CardDescription>
            </div>
            <ChartColumn className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm" role="status">
                Loading usage…
              </div>
            ) : error ? (
              <div
                className="flex h-[280px] items-center justify-center text-center text-destructive text-sm"
                role="alert"
              >
                {error}
              </div>
            ) : !usage?.totalRequests ? (
              <div className="flex h-[280px] items-center justify-center text-center text-muted-foreground text-sm">
                No authenticated API requests were recorded in this period.
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
            {(
              [
                ["Successful requests", successPercent],
                ["Errors", usage?.totalRequests ? (usage.errorRequests / usage.totalRequests) * 100 : null],
              ] satisfies Array<[string, number | null]>
            ).map(([label, percent]) => (
              <div key={String(label)} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{percent === null ? "—" : `${percent.toFixed(1)}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent ?? 0}%` }} />
                </div>
              </div>
            ))}
            <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
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
            <p className="p-6 text-center text-muted-foreground text-sm" role="status">
              Loading requests…
            </p>
          ) : error ? (
            <p className="p-6 text-center text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : !usage?.recent.length ? (
            <p className="p-6 text-center text-muted-foreground text-sm">
              No authenticated API requests were recorded in this period.
            </p>
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
