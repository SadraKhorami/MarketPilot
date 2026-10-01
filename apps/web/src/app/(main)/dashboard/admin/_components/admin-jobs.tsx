"use client";
import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { FilterSelect } from "../../_components/collection-filters";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import { QueueHealth, queueLabels } from "./queue-health";

interface JobsOverview {
  checkedAt: string;
  redis: "reachable" | "unavailable";
  activeWorkers: number | null;
  pendingEvaluations: number;
  pendingNotifications: number;
  queues: Array<{ name: string; paused: boolean; counts: Record<string, number> }> | null;
}
interface JobRecord {
  id: string;
  name: string;
  attempts: number;
  createdAt: string;
  failedAt: string | null;
  reason: string | null;
}
export function AdminJobs() {
  const [queue, setQueue] = useState("market-refresh");
  const [status, setStatus] = useState("failed");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const overview = useApiResource<JobsOverview>("/admin/jobs", { keepDataOnReload: true });
  const jobs = useApiResource<PagedResult<JobRecord>>(
    `/admin/jobs/${queue}?status=${status}&page=${page}&pageSize=${pageSize}`,
    { keepDataOnReload: true },
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      overview.reload();
      jobs.reload();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [overview.reload, jobs.reload]);
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
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Alert processing</CardTitle>
        <CardDescription>
          Market observations → rule evaluation → inbox and opted-in external delivery. Refreshes every 30 seconds.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            disabled={overview.loading || jobs.loading}
            onClick={() => {
              overview.reload();
              jobs.reload();
            }}
          >
            <RefreshCw data-icon="inline-start" /> Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <ResourceState {...overview} retry={overview.reload} />
        {overview.data && !overview.error ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Worker processes",
                  value: overview.data.activeWorkers,
                  detail: "Heartbeat received in the last 45 seconds",
                },
                {
                  label: "Pending evaluations",
                  value: overview.data.pendingEvaluations,
                  detail: "Saved observations awaiting rule checks",
                },
                {
                  label: "Pending notifications",
                  value: overview.data.pendingNotifications,
                  detail: "Saved triggers awaiting inbox delivery",
                },
              ].map((metric) => (
                <div key={metric.label} className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted/50 p-4">
                  <p className="text-muted-foreground text-xs">{metric.label}</p>
                  <p className="font-semibold text-2xl tabular-nums">{metric.value?.toLocaleString() ?? "—"}</p>
                  <p className="text-muted-foreground text-xs">{metric.detail}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-muted-foreground text-xs">
                Checked {new Date(overview.data.checkedAt).toLocaleTimeString()} · Heartbeats confirm running processes,
                not successful delivery.
              </p>
              <Badge variant={overview.data.redis === "reachable" ? "secondary" : "destructive"}>
                Redis {overview.data.redis}
              </Badge>
            </div>
            {overview.data.queues ? <QueueHealth queues={overview.data.queues} /> : null}
          </>
        ) : null}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm">Job inspection</h3>
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
                  <div key={job.id} className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {job.name} · {job.reason ?? status}
                      </p>
                      <p className="break-all text-muted-foreground text-xs">
                        {job.id} · {job.attempts} attempts · {new Date(job.failedAt ?? job.createdAt).toLocaleString()}
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
      </CardContent>
    </Card>
  );
}
