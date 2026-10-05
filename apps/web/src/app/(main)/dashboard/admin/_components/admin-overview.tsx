"use client";
import { useState } from "react";

import Link from "next/link";

import { Activity, ArrowUpRight, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useApiResource } from "@/hooks/use-api-resource";

import { FilterSelect, rangeOptions } from "../../_components/collection-filters";
import { ResourceState } from "../../_components/resource-state";
import type { AdminOverview } from "./admin-types";

const config = {
  browser: { label: "Browser sessions", color: "var(--chart-2)" },
  keys: { label: "API keys", color: "var(--chart-4)" },
} satisfies ChartConfig;
const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export function AdminOverviewWorkspace() {
  const [days, setDays] = useState("7");
  const resource = useApiResource<AdminOverview>(`/admin/overview?days=${days}`);
  const data = resource.data;
  if (resource.loading || resource.error || !data) return <ResourceState {...resource} retry={resource.reload} />;
  const successRate = data.requests ? ((data.requests - data.errors) / data.requests) * 100 : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="secondary">
          <ShieldCheck /> Administrator workspace
        </Badge>
        <FilterSelect label="Reporting period" value={days} onChange={setDays} options={rangeOptions} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Accounts",
            value: data.users,
            detail: `${data.activeUsers} active · ${data.admins} administrators`,
            icon: Users,
          },
          {
            label: "Authenticated requests",
            value: data.requests,
            detail: `${data.errors} errors in the selected period`,
            icon: Activity,
          },
          { label: "Active API keys", value: data.activeKeys, detail: "Valid, unrevoked credentials", icon: KeyRound },
          {
            label: "Active sessions",
            value: data.activeSessions,
            detail: "Unexpired browser sessions",
            icon: ShieldCheck,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardAction>
                <Icon className="size-4 text-muted-foreground" />
              </CardAction>
              <CardTitle className="text-3xl tabular-nums">{value.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Request volume</CardTitle>
              <CardDescription>Recorded requests by authentication method · daily totals</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={config} className="aspect-auto h-72 w-full">
                <LineChart accessibilityLayer data={data.traffic} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={formatDay} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={40} />
                  <ChartTooltip
                    content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="linear" dataKey="browser" stroke="var(--color-browser)" strokeWidth={2} dot={false} />
                  <Line
                    type="linear"
                    dataKey="keys"
                    stroke="var(--color-keys)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Most requested endpoints</CardTitle>
              <CardDescription>Top five routes in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ requests: { label: "Requests", color: "var(--chart-3)" } }}
                className="aspect-auto h-56 w-full"
              >
                <BarChart accessibilityLayer layout="vertical" data={data.endpoints} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="route"
                    width={145}
                    tickFormatter={(route: string) => route.replace("/api/v1/", "")}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="requests" fill="var(--color-requests)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Response quality</CardTitle>
              <CardDescription>Across recorded authenticated traffic</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <p className="font-semibold text-3xl tabular-nums">
                  {successRate === null ? "—" : `${successRate.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">Successful responses (below 400)</p>
                <Progress aria-label="Successful response rate" className="mt-3" value={successRate ?? 0} />
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-muted-foreground text-xs">Average latency</dt>
                  <dd className="mt-1 font-medium">
                    {data.averageLatencyMs === null ? "—" : `${Math.round(data.averageLatencyMs)} ms`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Errors</dt>
                  <dd className="mt-1 font-medium">{data.errors}</dd>
                </div>
              </dl>
              <Button variant="outline" asChild>
                <Link href="/dashboard/admin/requests">
                  Inspect requests <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent account events</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/admin/activity">
                    View all <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {data.events.map((event) => (
                <div key={event.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="font-medium text-sm">{event.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {event.user.email} · {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {!data.events.length && <p className="text-muted-foreground text-sm">No events recorded yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
