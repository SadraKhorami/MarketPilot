import { BellRing, ChartNoAxesCombined, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";

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
}: {
  queues: Array<{ name: string; paused: boolean; counts: Record<string, number> }>;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-3">
      {queues.map((queue) => {
        const details = queueDetails[queue.name];
        const Icon = details?.icon ?? ListChecks;
        const failed = queue.counts.failed ?? 0;
        let status = "No retained failures";
        if (failed > 0) status = "Failures to review";
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
                  <dt className="text-muted-foreground text-xs capitalize">{state}</dt>
                  <dd className="font-medium tabular-nums">{(queue.counts[state] ?? 0).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t pt-3">
              <Badge variant={failed > 0 ? "destructive" : "outline"}>{status}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
