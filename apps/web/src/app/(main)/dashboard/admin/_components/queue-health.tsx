import { BellRing, ChartNoAxesCombined, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { QueueRuntime } from "./admin-jobs";

export const queueLabels: Record<string, string> = {
  "market-refresh": "Market refresh",
  "alert-evaluation": "Rule evaluation",
  notifications: "Inbox delivery",
  "external-notifications": "External delivery",
  "bot-commands": "Bot commands",
};
const queueDetails: Record<string, { icon: typeof BellRing; detail: string }> = {
  "market-refresh": { icon: ChartNoAxesCombined, detail: "Fetch fresh provider observations" },
  "alert-evaluation": { icon: ListChecks, detail: "Check thresholds and persist crossings" },
  notifications: { icon: BellRing, detail: "Deliver saved triggers without duplicates" },
};
queueDetails["external-notifications"] = { icon: BellRing, detail: "Independent Telegram and Discord outbox" };
queueDetails["bot-commands"] = { icon: ListChecks, detail: "Private commands through authorized services" };
const states = ["waiting", "active", "delayed", "failed", "completed"] as const;

export function QueueHealth({
  queues,
  runtimes,
}: {
  queues: Array<{ name: string; paused: boolean; counts: Record<string, number>; recentFailed: number }>;
  runtimes: QueueRuntime[] | null;
}) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {queues.map((queue) => {
        const details = queueDetails[queue.name];
        const Icon = details?.icon ?? ListChecks;
        const failed = queue.counts.failed ?? 0;
        const consumers = runtimes?.filter((runtime) => runtime.name === queue.name) ?? [];
        const ready = consumers.filter((consumer) => consumer.ready).length;
        const latest = (values: Array<string | null>) =>
          values
            .filter((value): value is string => value !== null)
            .sort()
            .at(-1);
        const completedAt = latest(consumers.map((consumer) => consumer.lastCompletedAt));
        const failedAt = latest(consumers.map((consumer) => consumer.lastFailedAt));
        const lastFailure = consumers.find((consumer) => consumer.lastFailedAt === failedAt);
        let status = ready ? "Consumers ready" : "No ready consumers";
        if (queue.name === "bot-commands") status = "Inspect bot runtime below";
        if (queue.recentFailed > 0) status = "Recent failures";
        if (queue.paused) status = "Paused";
        return (
          <div key={queue.name} className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-medium text-sm">{queueLabels[queue.name] ?? queue.name}</p>
                <p className="text-muted-foreground text-xs">{details?.detail ?? "Background processing"}</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
              {states.map((state) => (
                <div key={state} className="flex flex-col gap-1">
                  <dt className="text-muted-foreground text-xs capitalize">
                    {state === "failed" ? "Retained failures" : state}
                  </dt>
                  <dd className="font-medium tabular-nums">{(queue.counts[state] ?? 0).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            {queue.name !== "bot-commands" ? (
              <dl className="flex flex-col gap-2 border-t pt-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Ready consumers</dt>
                  <dd className="tabular-nums">{runtimes === null ? "Unavailable" : ready}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Last completed job</dt>
                  <dd>{completedAt ? new Date(completedAt).toLocaleString() : "Not observed"}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">Last failed job</dt>
                  <dd>{failedAt ? new Date(failedAt).toLocaleString() : "Not observed"}</dd>
                </div>
                {lastFailure?.lastFailureCode ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Failure reason</dt>
                    <dd className="break-all text-destructive">{lastFailure.lastFailureCode}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Badge
                variant={
                  queue.recentFailed > 0 || queue.paused || (queue.name !== "bot-commands" && !ready)
                    ? "destructive"
                    : "outline"
                }
              >
                {status}
              </Badge>
              {failed > 0 ? <Badge variant="outline">{failed.toLocaleString()} retained failures</Badge> : null}
              {queue.recentFailed > 0 ? (
                <span className="text-muted-foreground text-xs">{queue.recentFailed} in the last 5 minutes</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
