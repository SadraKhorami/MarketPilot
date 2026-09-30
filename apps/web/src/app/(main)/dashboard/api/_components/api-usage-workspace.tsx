"use client";
import { useState } from "react";

import Link from "next/link";

import { ArrowUpRight, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";

import { FilterSelect, rangeOptions } from "../../_components/collection-filters";
import { ResourceState } from "../../_components/resource-state";
import type { KeyRecord, KeyUsage } from "./api-types";
import { UsageChart } from "./usage-chart";
export function ApiUsageWorkspace() {
  const [days, setDays] = useState("7");
  const [keyId, setKeyId] = useState("all");
  const keys = useApiResource<KeyRecord[]>("/api-keys");
  const resource = useApiResource<KeyUsage>(`/api-keys/usage?days=${days}${keyId === "all" ? "" : `&keyId=${keyId}`}`);
  const data = resource.data;
  if (resource.loading || resource.error || !data) return <ResourceState {...resource} retry={resource.reload} />;
  if (!data.keyCount && !data.totalRequests)
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRound />
              </EmptyMedia>
              <EmptyTitle>Your API usage starts with a key</EmptyTitle>
              <EmptyDescription>
                Dashboard browsing does not count here. This report tracks requests made by your developer integrations.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link href="/dashboard/api/keys">
                Create your first key <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </Empty>
        </CardContent>
      </Card>
    );
  const success = data.totalRequests ? (data.successfulRequests / data.totalRequests) * 100 : null;
  return (
    <div className="flex flex-col gap-5">
      {keys.error && <ResourceState {...keys} retry={keys.reload} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">API key requests only · revoked keys retain their history</p>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <FilterSelect
            label="API key"
            value={keyId}
            options={[
              ["all", "All keys"],
              ...(keys.data ?? []).map(
                (key) => [key.id, `${key.name}${key.revokedAt ? " (revoked)" : ""}`] as [string, string],
              ),
            ]}
            onChange={setKeyId}
          />
          <FilterSelect label="Usage period" value={days} options={rangeOptions} onChange={setDays} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Requests", data.totalRequests.toLocaleString(), `Across ${data.days} UTC days`],
          [
            "Successful",
            success === null ? "—" : `${success.toFixed(1)}%`,
            `${data.successfulRequests} successful responses`,
          ],
          [
            "Average latency",
            data.averageLatencyMs === null ? "—" : `${Math.round(data.averageLatencyMs)} ms`,
            "Measured by MarketPilot",
          ],
        ].map(([label, value, detail]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Daily requests</CardTitle>
            <CardDescription>Recorded API key traffic · UTC</CardDescription>
          </CardHeader>
          <CardContent>
            {data.totalRequests ? (
              <UsageChart data={data.byDay} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No key requests in this period</EmptyTitle>
                  <EmptyDescription>Try the API with a scoped key, or select a wider period.</EmptyDescription>
                </EmptyHeader>
                <Button asChild variant="outline">
                  <Link href="/dashboard/api/documentation">Read the API guide</Link>
                </Button>
              </Empty>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Request outcomes</CardTitle>
            <CardDescription>Success and error responses</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex justify-between text-sm">
              <span>Successful</span>
              <span className="tabular-nums">{data.successfulRequests}</span>
            </div>
            <Progress aria-label="Successful response rate" value={success ?? 0} />
            <div className="flex justify-between text-sm">
              <span>Errors (4xx / 5xx)</span>
              <span className="tabular-nums">{data.errorRequests}</span>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="font-medium text-sm">
                {data.rateLimit.requests} requests / {data.rateLimit.windowSeconds}s
              </p>
              <p className="mt-1 text-muted-foreground text-xs">Per key. This is a rate limit, not a billing quota.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Latest key requests</CardTitle>
          <CardDescription>Most recent 10 requests within the selected filters</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {data.recent.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Endpoint</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-4 pl-6">
                      <code className="text-xs">
                        {row.method} {row.route}
                      </code>
                    </TableCell>
                    <TableCell>{row.apiKey?.name ?? "Deleted key"}</TableCell>
                    <TableCell>
                      <Badge variant={row.statusCode >= 400 ? "destructive" : "outline"}>{row.statusCode}</Badge>
                    </TableCell>
                    <TableCell>{row.latencyMs} ms</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(row.occurredAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 text-muted-foreground text-sm">No requests recorded in this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
