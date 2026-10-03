import { BellRing, ChartNoAxesCombined, ChevronDown, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  onInspect,
}: {
  queues: Array<{ name: string; paused: boolean; counts: Record<string, number>; recentFailed: number }>;
  runtimes: QueueRuntime[] | null;
  onInspect?: (name: string) => void;
}) {
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <CardTitle>Background queues</CardTitle>
        <CardDescription>
          Consumer readiness from recent heartbeats · recent failures cover the last 5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_9rem_11rem_7rem] items-center gap-4 border-y bg-muted/40 px-4 py-2 text-muted-foreground text-xs md:grid"
        >
          <span>Queue</span>
          <span>Health</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
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
          if (runtimes === null) status = "Readiness unavailable";
          if (queue.name === "bot-commands") status = "Inspect bot runtime below";
          if (queue.recentFailed > 0) status = "Recent failures";
          if (queue.paused) status = "Paused";
          return (
            <Collapsible key={queue.name} className="border-b last:border-b-0">
              <div className="grid items-center gap-4 px-4 py-2 md:grid-cols-[minmax(0,1fr)_9rem_11rem_7rem]">
                <div className="flex min-w-0 items-center gap-3">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="group aria-expanded:bg-transparent"
                      aria-label={`Toggle ${queueLabels[queue.name] ?? queue.name} details`}
                    >
                      <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate font-medium text-sm">{queueLabels[queue.name] ?? queue.name}</span>
                </div>
                <ConsumerReadiness ready={ready} total={consumers.length} unavailable={runtimes === null} />
                <div>
                  <Badge variant={queue.recentFailed > 0 || queue.paused || !ready ? "destructive" : "outline"}>
                    {status}
                  </Badge>
                </div>
                <div className="flex justify-end">
                  {onInspect ? (
                    <Button variant="outline" size="sm" onClick={() => onInspect(queue.name)}>
                      Inspect jobs
                    </Button>
                  ) : null}
                </div>
              </div>
              <CollapsibleContent className="border-t bg-muted/20">
                <div className="flex flex-col gap-3 px-4 py-3">
                  <p className="text-muted-foreground text-xs">{details?.detail ?? "Background processing"}</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5">
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
                  {failed > 0 || queue.recentFailed > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      {failed > 0 ? <Badge variant="outline">{failed.toLocaleString()} retained failures</Badge> : null}
                      {queue.recentFailed > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {queue.recentFailed} in the last 5 minutes
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ConsumerReadiness({ ready, total, unavailable }: { ready: number; total: number; unavailable: boolean }) {
  const filled = total ? Math.round((ready / total) * 18) : 0;
  const label = unavailable ? "Readiness unavailable" : `${ready}/${total} consumers ready`;
  return (
    <div className="flex flex-col gap-1">
      <div role="img" aria-label={label} className="flex gap-0.5">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={`readiness-${index}`}
            className={index < filled ? "h-3 w-1 rounded-full bg-emerald-500" : "h-3 w-1 rounded-full bg-muted"}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">{label}</span>
    </div>
  );
}
