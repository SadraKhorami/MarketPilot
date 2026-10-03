"use client";
import { useEffect, useRef, useState } from "react";

import { ChevronDown, ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { FilterSelect } from "../../_components/collection-filters";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SystemState } from "./admin-types";
import { SystemInfrastructure } from "./system-infrastructure";
import { useSystemRefresh } from "./use-system-refresh";
import { QueueHealth, queueLabels } from "./queue-health";

export interface QueueRuntime {
  name: string;
  ready: boolean;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastFailureCode: string | null;
  lastLatencyMs: number | null;
}
interface JobsOverview {
  checkedAt: string;
  status: "healthy" | "degraded" | "unavailable";
  workers: Array<{ workerId: string; checkedAt: string; ready: boolean; queues: QueueRuntime[] }> | null;
  redis: "reachable" | "unavailable";
  activeWorkers: number | null;
  pendingEvaluations: number | null;
  pendingNotifications: number | null;
  queues: Array<{ name: string; paused: boolean; counts: Record<string, number>; recentFailed: number }> | null;
}
interface JobRecord {
  id: string;
  name: string;
  attempts: number;
  createdAt: string;
  failedAt: string | null;
  reason: string | null;
}

export function AdminJobs({
  system,
}: {
  system: { data: SystemState | null; loading: boolean; error: string | null; reload: () => void };
}) {
  const [queue, setQueue] = useState("market-refresh");
  const [status, setStatus] = useState("failed");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const inspection = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const overview = useApiResource<JobsOverview>("/admin/jobs", { keepDataOnReload: true });
  const jobs = useApiResource<PagedResult<JobRecord>>(
    `/admin/jobs/${queue}?status=${status}&page=${page}&pageSize=${pageSize}`,
    { keepDataOnReload: true },
  );
  useSystemRefresh(() => {
    overview.reload();
    jobs.reload();
  });
  useEffect(() => {
    if (jobs.data && page > Math.max(1, jobs.data.totalPages)) setPage(Math.max(1, jobs.data.totalPages));
  }, [jobs.data, page]);
  async function retry(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await apiRequest(`/admin/jobs/${queue}/${encodeURIComponent(id)}/retry`, { method: "POST" });
      jobs.reload();
      overview.reload();
      toast.success("Job recovery requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry job.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-lg">System overview</h2>
          <p className="text-muted-foreground text-xs">
            Auto-refresh · 30 seconds
            {overview.data ? ` · Workers checked ${new Date(overview.data.checkedAt).toLocaleTimeString()}` : ""}
            {system.data ? ` · Infrastructure checked ${new Date(system.data.checkedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={system.loading || overview.loading || jobs.loading}
          onClick={() => {
            window.dispatchEvent(new Event("marketpilot:system-refresh"));
          }}
        >
          <RefreshCw data-icon="inline-start" />
          Refresh all
        </Button>
      </div>
      <ResourceState {...system} retry={system.reload} />
      <ResourceState {...overview} retry={overview.reload} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3 py-4">
          <CardHeader className="px-5">
            <CardTitle className="text-muted-foreground text-xs">Infrastructure</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-5">
            <p className="font-semibold text-2xl tabular-nums">
              {system.data && !system.error
                ? `${[system.data.database, system.data.redis].filter((check) => check.status === "healthy").length}/2`
                : "—"}
            </p>
            <p className="text-muted-foreground text-xs">Healthy database and cache checks</p>
          </CardContent>
        </Card>
        {[
          {
            label: "Ready workers",
            value: overview.data?.activeWorkers,
            detail: "Heartbeat within the last 45 seconds",
          },
          {
            label: "Pending evaluations",
            value: overview.data?.pendingEvaluations,
            detail: "Observations waiting for rule checks",
          },
          {
            label: "Pending notifications",
            value: overview.data?.pendingNotifications,
            detail: "Triggers waiting for inbox delivery",
          },
        ].map((metric) => (
          <Card key={metric.label} className="gap-3 py-4">
            <CardHeader className="px-5">
              <CardTitle className="text-muted-foreground text-xs">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-5">
              <p className="font-semibold text-2xl tabular-nums">
                {overview.error ? "—" : (metric.value?.toLocaleString() ?? "—")}
              </p>
              <p className="text-muted-foreground text-xs">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {system.data && !system.error ? <SystemInfrastructure data={system.data} /> : null}
      {overview.data?.queues && !overview.error ? (
        <QueueHealth
          queues={overview.data.queues.filter((item) => item.name !== "bot-commands")}
          runtimes={overview.data.workers?.flatMap((worker) => worker.queues) ?? null}
          onInspect={(name) => {
            setQueue(name);
            setPage(1);
            setInspectionOpen(true);
            requestAnimationFrame(() => inspection.current?.scrollIntoView({ block: "nearest" }));
          }}
        />
      ) : null}
      <Collapsible
        ref={inspection}
        open={inspectionOpen}
        onOpenChange={setInspectionOpen}
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div className="flex min-w-0 items-center gap-3 px-4 py-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group aria-expanded:bg-transparent"
              aria-label="Toggle job inspection"
            >
              <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <ListChecks className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h3 className="shrink-0 font-medium text-sm">Job inspection</h3>
          <p className="min-w-0 truncate text-muted-foreground text-xs">
            {queueLabels[queue]} · {status} jobs
          </p>
        </div>
        <CollapsibleContent className="border-t">
          <div className="flex min-w-0 flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Select a queue and state to inspect retained jobs.</p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-3">
                <FilterSelect
                  label="Queue"
                  value={queue}
                  options={[
                    ["market-refresh", "Market refresh"],
                    ["alert-evaluation", "Evaluation"],
                    ["notifications", "Inbox delivery"],
                    ["external-notifications", "External delivery"],
                    ["bot-commands", "Bot commands"],
                  ]}
                  onChange={(value) => {
                    setQueue(value);
                    setPage(1);
                  }}
                />
                <FilterSelect
                  label="Job status"
                  value={status}
                  options={[
                    ["failed", "Failed"],
                    ["waiting", "Waiting"],
                    ["active", "Active"],
                    ["delayed", "Delayed"],
                  ]}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <ResourceState {...jobs} retry={jobs.reload} />
            {!jobs.loading && !jobs.error && jobs.data ? (
              <>
                {jobs.data.items.length ? (
                  <div className="flex flex-col divide-y">
                    {jobs.data.items.map((job) => (
                      <div
                        key={job.id}
                        className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {job.name} · {job.reason ?? status}
                          </p>
                          <p className="break-all text-muted-foreground text-xs">
                            {job.id} · {job.attempts} attempts ·{" "}
                            {new Date(job.failedAt ?? job.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {status === "failed" && queue !== "external-notifications" ? (
                          <Button
                            className="shrink-0"
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => void retry(job.id)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{status === "failed" ? "No failures to review" : `No ${status} jobs`}</EmptyTitle>
                      <EmptyDescription>
                        {queueLabels[queue] ?? queue} currently has no retained {status} jobs.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <CollectionPagination
                  page={page}
                  pageSize={pageSize}
                  total={jobs.data.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
